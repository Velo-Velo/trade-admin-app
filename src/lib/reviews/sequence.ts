/** Days after the job is marked complete or the invoice is paid. Three notes, then stop. */
export const REVIEW_OFFSETS_DAYS = [1, 4, 8] as const;

const DAY = 24 * 60 * 60 * 1000;

export type ReviewJob = {
  reviewChaserEnabled: boolean;
  traderEnabled: boolean;
  reviewStage: number;
  reviewClickedAt: Date | null;
  jobCompletedAt: Date | null;
  lastReviewAt: Date | null;
  hasReviewUrl: boolean;
  hasEmail: boolean;
};

export function isReviewDue(job: ReviewJob, now: Date): boolean {
  if (!job.reviewChaserEnabled || !job.traderEnabled) return false;
  if (job.reviewClickedAt) return false;
  if (!job.jobCompletedAt) return false;
  if (!job.hasReviewUrl || !job.hasEmail) return false;
  if (job.reviewStage < 0 || job.reviewStage >= REVIEW_OFFSETS_DAYS.length) return false;
  const sendAt = job.jobCompletedAt.getTime() + REVIEW_OFFSETS_DAYS[job.reviewStage] * DAY;
  if (now.getTime() < sendAt) return false;
  if (job.lastReviewAt && now.getTime() - job.lastReviewAt.getTime() < DAY) return false;
  return true;
}

export function reviewCopy(input: {
  stage: number;
  businessName: string;
  customerName: string;
  trackUrl: string;
}): { subject: string; text: string } {
  const hello = `Hello ${input.customerName},`;
  if (input.stage <= 0) {
    return {
      subject: `How did ${input.businessName} get on?`,
      text: [
        hello,
        "",
        `If the work was all right, a short Google review helps ${input.businessName}.`,
        input.trackUrl,
        "",
        "No problem if you would rather not.",
      ].join("\n"),
    };
  }
  if (input.stage === 1) {
    return {
      subject: `A review of ${input.businessName}, if you have a moment`,
      text: [
        hello,
        "",
        `A reminder about a Google review for ${input.businessName}, if the job went well.`,
        input.trackUrl,
      ].join("\n"),
    };
  }
  return {
    subject: `Last note about a review for ${input.businessName}`,
    text: [
      hello,
      "",
      `This is the last note from us about a Google review. The link is here if you want it:`,
      input.trackUrl,
    ].join("\n"),
  };
}
