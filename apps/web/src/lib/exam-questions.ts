import { randomUUID } from "node:crypto";
import { ApiError } from "@/lib/http";

export type ExamQuestion = {
  questionNumber: string;
  questionText: string;
  markingScheme: string;
  marks: number;
  children: ExamQuestion[];
};

type QuestionRow = {
  id: string;
  parentQuestionId: string | null;
  questionNumber: string;
  questionText: string;
  markingScheme: string;
  marks: number;
  sortOrder: number;
};

export type QuestionCreateRow = {
  id: string;
  examId: string;
  parentQuestionId: string | null;
  questionNumber: string;
  questionText: string;
  markingScheme: string;
  marks: number;
  sortOrder: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textValue(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value
      .map((item) => typeof item === "string" ? item.trim() : JSON.stringify(item))
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function firstValue(record: Record<string, unknown>, keys: string[]) {
  return keys.map((key) => record[key]).find((value) => value !== undefined && value !== null);
}

function parseQuestion(
  value: unknown,
  fallbackNumber: string,
  path: string,
  seenNumbers: Set<string>,
): ExamQuestion {
  if (!isRecord(value)) throw new ApiError(`${path} must be an object`);

  const questionNumber = textValue(firstValue(value, ["questionNumber", "number", "id"])) || fallbackNumber;
  if (!questionNumber || questionNumber.length > 24) {
    throw new ApiError(`${path} must have a question number of at most 24 characters`);
  }
  if (seenNumbers.has(questionNumber)) {
    throw new ApiError(`Question number "${questionNumber}" is duplicated`);
  }
  seenNumbers.add(questionNumber);

  const questionText = textValue(firstValue(value, ["questionText", "text", "question"]));
  if (!questionText || questionText.length > 10000) {
    throw new ApiError(`Question ${questionNumber} must include question text (up to 10,000 characters)`);
  }

  const markingScheme = textValue(firstValue(value, ["markingScheme", "answerKey"]));
  if (!markingScheme || markingScheme.length > 20000) {
    throw new ApiError(`Question ${questionNumber} must include the teacher's marking scheme (up to 20,000 characters)`);
  }

  const rawMarks = firstValue(value, ["marks", "points"]);
  if (
    typeof rawMarks !== "number"
    || !Number.isSafeInteger(rawMarks)
    || rawMarks < 1
    || rawMarks > 2_147_483_647
  ) {
    throw new ApiError(`Question ${questionNumber} must have a positive whole-number mark allocation within the supported limit`);
  }

  const rawChildren = firstValue(value, ["subQuestions", "parts", "children"]);
  if (rawChildren !== undefined && !Array.isArray(rawChildren)) {
    throw new ApiError(`Sub-parts for question ${questionNumber} must be an array`);
  }
  const children = (rawChildren ?? []).map((child, index) => (
    parseQuestion(child, `${questionNumber}${String.fromCharCode(97 + index)}`, `${path}.subQuestions[${index}]`, seenNumbers)
  ));

  return { questionNumber, questionText, markingScheme, marks: rawMarks, children };
}

function parseFlatQuestions(values: unknown[]): ExamQuestion[] {
  const parsed = values.map((value, index) => {
    if (!isRecord(value)) throw new ApiError(`Question ${index + 1} must be an object`);
    const parentNumber = textValue(value.parentQuestionNumber);
    const question = parseQuestion(
      { ...value, subQuestions: undefined },
      String(index + 1),
      `Question ${index + 1}`,
      new Set(),
    );
    return { question, parentNumber, sortOrder: index };
  });
  const numbers = new Set<string>();
  for (const { question } of parsed) {
    if (numbers.has(question.questionNumber)) throw new ApiError(`Question number "${question.questionNumber}" is duplicated`);
    numbers.add(question.questionNumber);
  }

  const byNumber = new Map(parsed.map((entry) => [entry.question.questionNumber, entry]));
  const childrenByParent = new Map<string, typeof parsed>();
  const roots: typeof parsed = [];
  for (const entry of parsed) {
    if (!entry.parentNumber) {
      roots.push(entry);
      continue;
    }
    if (entry.parentNumber === entry.question.questionNumber || !byNumber.has(entry.parentNumber)) {
      throw new ApiError(`Parent question "${entry.parentNumber}" for ${entry.question.questionNumber} was not found`);
    }
    const siblings = childrenByParent.get(entry.parentNumber) ?? [];
    siblings.push(entry);
    childrenByParent.set(entry.parentNumber, siblings);
  }

  const buildTree = (entry: (typeof parsed)[number], visited: Set<string>): ExamQuestion => {
    const number = entry.question.questionNumber;
    if (visited.has(number)) throw new ApiError("Question hierarchy cannot contain a cycle");
    const nextVisited = new Set(visited).add(number);
    const children = (childrenByParent.get(number) ?? []).map((child) => buildTree(child, nextVisited));
    return { ...entry.question, children };
  };

  const tree = roots.map((root) => buildTree(root, new Set()));
  if (tree.length === 0 || tree.reduce((count, root) => count + countQuestions(root), 0) !== parsed.length) {
    throw new ApiError("Question hierarchy must have at least one top-level question and no cycles");
  }
  return tree;
}

function countQuestions(question: ExamQuestion): number {
  return 1 + question.children.reduce((count, child) => count + countQuestions(child), 0);
}

export function parseExamQuestions(rubricJson: string): ExamQuestion[] {
  let rubric: unknown;
  try {
    rubric = JSON.parse(rubricJson) as unknown;
  } catch {
    throw new ApiError("The exam rubric is not valid JSON");
  }
  if (!isRecord(rubric) || !Array.isArray(rubric.questions)) {
    throw new ApiError("The exam must contain a questions array");
  }

  const values = rubric.questions;
  if (values.some((value) => isRecord(value) && "parentQuestionNumber" in value)) {
    if (!values.every((value) => isRecord(value) && !("subQuestions" in value) && !("parts" in value) && !("children" in value))) {
      throw new ApiError("Use either flat question entries or nested sub-parts, not both");
    }
    return parseFlatQuestions(values);
  }

  const seenNumbers = new Set<string>();
  const questions = values.map((question, index) => (
    parseQuestion(question, String(index + 1), `Question ${index + 1}`, seenNumbers)
  ));
  if (questions.length === 0) throw new ApiError("The exam must contain at least one question");
  return questions;
}

export function questionCreateRows(questions: ExamQuestion[], examId: string): QuestionCreateRow[] {
  const rows: QuestionCreateRow[] = [];
  const addQuestion = (question: ExamQuestion, parentQuestionId: string | null, sortOrder: number) => {
    const id = randomUUID();
    rows.push({
      id,
      examId,
      parentQuestionId,
      questionNumber: question.questionNumber,
      questionText: question.questionText,
      markingScheme: question.markingScheme,
      marks: question.marks,
      sortOrder,
    });
    question.children.forEach((child, index) => addQuestion(child, id, index));
  };
  questions.forEach((question, index) => addQuestion(question, null, index));
  return rows;
}

export function questionsFromRows(rows: QuestionRow[]): ExamQuestion[] {
  const sortOrderByNode = new Map<ExamQuestion, number>();
  const byId = new Map(rows.map((row) => [row.id, {
    node: {
      questionNumber: row.questionNumber,
      questionText: row.questionText,
      markingScheme: row.markingScheme,
      marks: row.marks,
      children: [] as ExamQuestion[],
    } satisfies ExamQuestion,
    parentQuestionId: row.parentQuestionId,
    sortOrder: row.sortOrder,
  }]));
  byId.forEach((entry) => sortOrderByNode.set(entry.node, entry.sortOrder));
  const roots: ExamQuestion[] = [];
  for (const row of rows) {
    const entry = byId.get(row.id);
    if (!entry) throw new ApiError("Question hierarchy is invalid");
    const parent = row.parentQuestionId ? byId.get(row.parentQuestionId) : undefined;
    if (row.parentQuestionId && !parent) {
      throw new ApiError(`Parent question for ${row.questionNumber} was not found`);
    }
    if (parent) parent.node.children.push(entry.node);
    else roots.push(entry.node);
  }

  const sortTree = (node: ExamQuestion) => {
    node.children.sort((first, second) => (
      (sortOrderByNode.get(first) ?? 0) - (sortOrderByNode.get(second) ?? 0)
    ));
    node.children.forEach(sortTree);
  };
  roots.sort((first, second) => (
    (sortOrderByNode.get(first) ?? 0) - (sortOrderByNode.get(second) ?? 0)
  ));
  roots.forEach(sortTree);

  const visited = new Set<string>();
  const validateTree = (node: ExamQuestion) => {
    if (visited.has(node.questionNumber)) throw new ApiError("Question hierarchy cannot contain a cycle");
    visited.add(node.questionNumber);
    node.children.forEach(validateTree);
  };
  roots.forEach(validateTree);
  if (visited.size !== rows.length) throw new ApiError("Question hierarchy contains unreachable questions");
  const numbers = new Set(rows.map((row) => row.questionNumber));
  if (numbers.size !== rows.length) throw new ApiError("Question numbers must be unique within an exam");
  return roots;
}

export function scoreableQuestions(questions: ExamQuestion[]): ExamQuestion[] {
  return questions.flatMap((question) => (
    question.children.length === 0 ? [question] : scoreableQuestions(question.children)
  ));
}

export function validateMarkingSchemes(questions: ExamQuestion[]) {
  const leaves = scoreableQuestions(questions);
  if (leaves.length === 0) throw new ApiError("The exam must contain at least one question that can be graded");
  const totalMarks = leaves.reduce((total, question) => total + question.marks, 0);
  if (!Number.isSafeInteger(totalMarks) || totalMarks > 2_147_483_647) {
    throw new ApiError("The exam's total marks exceed the supported limit");
  }
  const validateTotals = (question: ExamQuestion) => {
    if (question.children.length > 0) {
      const partMarks = question.children.reduce((total, child) => total + sumLeafMarks(child), 0);
      if (question.marks !== partMarks) {
        throw new ApiError(`Question ${question.questionNumber} marks must equal the total marks allocated to its sub-parts (${partMarks})`);
      }
      question.children.forEach(validateTotals);
    }
  };
  questions.forEach(validateTotals);
  for (const question of leaves) {
    if (!question.markingScheme.trim()) {
      throw new ApiError(`Question ${question.questionNumber} needs a teacher-provided marking scheme before grading`);
    }
    if (question.marks < 1) {
      throw new ApiError(`Question ${question.questionNumber} needs a positive mark allocation before grading`);
    }
  }
  return leaves;
}

function sumLeafMarks(question: ExamQuestion): number {
  return question.children.length === 0
    ? question.marks
    : question.children.reduce((total, child) => total + sumLeafMarks(child), 0);
}
