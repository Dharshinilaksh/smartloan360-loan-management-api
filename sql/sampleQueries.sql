-- Total loan amount by customer
SELECT c.customer_name,
       SUM(l.sanctioned_amount) AS total_loan
FROM customers c
JOIN loan_accounts l
  ON c.customer_id = l.customer_id
GROUP BY c.customer_name;

-- Overdue EMI report
SELECT emi_no, due_date, emi_amount
FROM emi_schedule
WHERE status != 'PAID'
  AND due_date < CURDATE();

-- Portfolio dashboard
SELECT COUNT(*) AS total_loans,
       SUM(sanctioned_amount) AS total_sanctioned_amount
FROM loan_accounts;