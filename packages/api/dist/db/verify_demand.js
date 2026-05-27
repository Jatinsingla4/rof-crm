import { db } from '../index';
async function testDemandGeneration() {
    const consumerId = '349d44c4-7932-4752-944d-3b5643440784'; // Example consumer
    const demandsRes = await db.query(`SELECT d.*, 
      (SELECT COALESCE(SUM(amount_received_inr),0) FROM receipts WHERE payment_plan_id = d.payment_plan_id AND installment_index = d.installment_index) as amount_paid,
      EXTRACT(DAY FROM NOW() - d.due_date)::INT as days_overdue
     FROM demands d 
     WHERE consumer_id = $1 AND status != 'pending'
     ORDER BY installment_index ASC`, [consumerId]);
    console.log('--- DEMAND GENERATION TEST ---');
    console.log('Total Demands Found:', demandsRes.rows.length);
    demandsRes.rows.forEach(dm => {
        const installment = parseFloat(dm.amount_due_inr);
        const cgst = parseFloat(dm.cgst_amount || 0);
        const sgst = parseFloat(dm.sgst_amount || 0);
        const amtDue = installment + cgst + sgst;
        const amtPaid = parseFloat(dm.amount_paid || 0);
        const interest = Math.round(((amtDue - amtPaid) * 0.15 * Math.max(0, dm.days_overdue)) / 365);
        console.log(`Installment ${dm.installment_index}: Due=${amtDue}, Paid=${amtPaid}, DaysOverdue=${dm.days_overdue}, Interest=${interest}`);
    });
}
// This is just a scratch script logic, not for execution in production.
//# sourceMappingURL=verify_demand.js.map