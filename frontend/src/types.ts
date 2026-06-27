/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Question {
  id: number;
  text: string;
  options: string[];
  correctAnswer: string;
  points: number;
  image?: string;
}

export type QuestionState = 'answered' | 'current' | 'remaining';
