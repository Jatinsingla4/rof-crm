// GST invoices that now charge more than the money behind them: the receipt was cancelled or bounced, or a bank return (net of approved returns) took the receipt
// below what the invoice still charges (invoice total less credit notes issued, plus debit notes issued). Reads only. Nothing is cancelled or credited here:
// cancelling an invoice or issuing a credit note stays with a checker (Cancel / Reverse / Credit note tabs).
export async function invoicesOverReceipt(db: any, receiptId: string | null = null): Promise<any[]> {
  return (await db.query(
    `SELECT gi.id, gi.invoice_no, gi.total_amount_inr::float8 AS invoice_total, (gi.total_amount_inr - COALESCE(cn.adj, 0))::float8 AS still_charged,
            r.status AS receipt_status, (r.amount_received_inr - COALESCE(rt.returned, 0))::float8 AS receipt_net
       FROM gst_invoices gi JOIN receipts r ON r.id = gi.receipt_id
       LEFT JOIN LATERAL (SELECT SUM(CASE WHEN n.note_type = 'credit' THEN n.total_amount ELSE -n.total_amount END) AS adj FROM credit_debit_notes n WHERE n.invoice_id = gi.id AND n.status = 'issued') cn ON true
       LEFT JOIN LATERAL (SELECT SUM(x.amount) AS returned FROM receipt_returns x WHERE x.receipt_id = r.id AND x.status = 'approved') rt ON true
      WHERE gi.status <> 'cancelled' AND ($1::uuid IS NULL OR r.id = $1)
        AND (r.status IN ('cancelled', 'bounced') OR (gi.total_amount_inr - COALESCE(cn.adj, 0)) > (r.amount_received_inr - COALESCE(rt.returned, 0)) + 0.01)
      ORDER BY gi.invoice_no`, [receiptId])).rows;
}
