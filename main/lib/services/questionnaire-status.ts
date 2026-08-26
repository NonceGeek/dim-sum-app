export type QuestionnaireStatusSource = {
  phoneNumber: string | null;
  questionnaireProfile: { completed_at: Date } | null;
};

export function buildQuestionnaireStatus(user: QuestionnaireStatusSource) {
  return {
    completed: Boolean(user.questionnaireProfile),
    phoneVerified: Boolean(user.phoneNumber),
    completedAt: user.questionnaireProfile?.completed_at.toISOString() ?? null,
  };
}
