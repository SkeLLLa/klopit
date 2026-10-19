import type { FaqMessageKey } from '#lib/constants/faq.js';
import { m } from '#lib/paraglide/messages.js';

// Explicit references (not `m[key]`) keep the bundler able to tree-shake unused messages.
export const faqMessages: Readonly<Record<FaqMessageKey, () => string>> = {
  faq_01_question: m.faq_01_question,
  faq_01_answer: m.faq_01_answer,
  faq_02_question: m.faq_02_question,
  faq_02_answer: m.faq_02_answer,
  faq_03_question: m.faq_03_question,
  faq_03_answer: m.faq_03_answer,
  faq_04_question: m.faq_04_question,
  faq_04_answer: m.faq_04_answer,
  faq_05_question: m.faq_05_question,
  faq_05_answer: m.faq_05_answer,
  faq_06_question: m.faq_06_question,
  faq_06_answer: m.faq_06_answer,
  faq_07_question: m.faq_07_question,
  faq_07_answer: m.faq_07_answer,
  faq_08_question: m.faq_08_question,
  faq_08_answer: m.faq_08_answer,
  faq_09_question: m.faq_09_question,
  faq_09_answer: m.faq_09_answer,
  faq_10_question: m.faq_10_question,
  faq_10_answer: m.faq_10_answer,
  faq_11_question: m.faq_11_question,
  faq_11_answer: m.faq_11_answer,
  faq_12_question: m.faq_12_question,
  faq_12_answer: m.faq_12_answer,
  faq_13_question: m.faq_13_question,
  faq_13_answer: m.faq_13_answer,
};
