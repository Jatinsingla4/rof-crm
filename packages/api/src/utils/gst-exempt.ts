// Who is treated as GST-exempt on the unit price: NRI, OCI and PIO applicants (CGST and SGST 0). ONE definition: it used to be copied into a dozen places, some case-sensitive and one
// (the manual demand generator) knowing only 'nri', so an OCI or PIO applicant got GST on a demand but not on the booking. That the exemption itself is right is a finance and tax-advisor
// decision; this only makes the code apply the rule it already had in the same way everywhere.
export const GST_EXEMPT_NATIONALITIES = ['nri', 'oci', 'pio'] as const;
export const isGstExempt = (nationality: any): boolean => (GST_EXEMPT_NATIONALITIES as readonly string[]).includes(String(nationality ?? '').trim().toLowerCase());
