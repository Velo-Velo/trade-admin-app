/**
 * Placeholder only. This is not the prescribed cancellation notice.
 * A solicitor needs to sign off the wording, the information list, and the
 * cancellation form before this is used with real customers.
 */
export const COOLING_OFF_NOTICE = `FOR LEGAL REVIEW — this is not the prescribed cancellation wording.

If you are a consumer and you agreed this contract at a distance (for example by phone, email, website or messaging), the Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013 may give you 14 days to cancel, starting the day after you agree.

This app does not yet include the official cancellation form, the required information list, or a way to ask for work to start inside the cancellation period. Have a solicitor sign off the wording before you use it with customers.`;

export function coolingOffFor(domestic: boolean): string {
  return domestic ? COOLING_OFF_NOTICE : "";
}
