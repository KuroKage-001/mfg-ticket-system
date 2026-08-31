/**
 * Ticket number format utilities.
 *
 * Format: MFG-{YEAR}-{SEQUENCE}
 * where YEAR is a 4-digit integer and SEQUENCE is zero-padded to 6 digits.
 * Example: MFG-2026-000001
 */

const TICKET_NUMBER_REGEX = /^MFG-(\d{4})-(\d{6})$/;

/**
 * Formats a year and sequence number into the canonical ticket number string.
 *
 * @param year     4-digit calendar year (e.g. 2026)
 * @param sequence Sequence number between 1 and 999999 (inclusive)
 * @returns        Ticket number string, e.g. "MFG-2026-000001"
 */
export function formatTicketNumber(year: number, sequence: number): string {
  return `MFG-${year}-${String(sequence).padStart(6, "0")}`;
}

/**
 * Parses a ticket number string and returns its constituent year and sequence.
 *
 * @param ticketNumber String to parse, e.g. "MFG-2026-000001"
 * @returns            `{ year, sequence }` on a valid match, or `null` if the
 *                     string does not conform to the expected format.
 */
export function parseTicketNumber(
  ticketNumber: string
): { year: number; sequence: number } | null {
  const match = TICKET_NUMBER_REGEX.exec(ticketNumber);
  if (!match) return null;

  return {
    year: parseInt(match[1], 10),
    sequence: parseInt(match[2], 10),
  };
}
