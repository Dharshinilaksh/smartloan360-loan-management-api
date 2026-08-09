const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

// MySQL connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'Dharshini@123',
  database: 'loan_mgmt_db'
});

// Connect to MySQL
db.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err);
  } else {
    console.log('Connected to MySQL');
  }
});

// Test route
app.get('/', (req, res) => {
  res.send('LOCS API Running');
});

// Get all customers
app.get('/customers', (req, res) => {
  const sql = 'SELECT * FROM customers';

  db.query(sql, (err, result) => {
    if (err) {
      res.status(500).json(err);
    } else {
      res.json(result);
      
    }
  });
  res.send('Datas saved');
});

// Add customer
app.post('/customers', (req, res) => {
  const { customer_name, phone, email, city } = req.body;

  const sql = `
    INSERT INTO customers(customer_name, phone, email, city)
    VALUES (?, ?, ?, ?)
  `;

  db.query(sql,
    [customer_name, phone, email, city],
    (err, result) => {
      if (err) return res.status(500).json(err);

      res.json({
        message: 'Customer registered successfully',
        customer_id: result.insertId
      });
    });
});

// Apply for loan
app.post('/loan-applications', (req, res) => {
  const {
    customer_id,
    loan_type,
    loan_amount,
    interest_rate,
    tenure_months
  } = req.body;

  // Basic validation
  if (!customer_id || !loan_type || !loan_amount || !interest_rate || !tenure_months) {
    return res.status(400).json({
      message: 'All fields are required'
    });
  }

  // Business rule validations
  if (loan_amount <= 0) {
    return res.status(400).json({
      message: 'Loan amount must be greater than zero'
    });
  }

  if (interest_rate <= 0 || interest_rate > 25) {
    return res.status(400).json({
      message: 'Interest rate must be between 0 and 25'
    });
  }

  if (tenure_months < 6 || tenure_months > 360) {
    return res.status(400).json({
      message: 'Tenure must be between 6 and 360 months'
    });
  }

  // Check whether customer exists
  const checkCustomerSql = 'SELECT customer_id FROM customers WHERE customer_id = ?';

  db.query(checkCustomerSql, [customer_id], (err, customerResult) => {
    if (err) return res.status(500).json(err);

    if (customerResult.length === 0) {
      return res.status(404).json({
        message: 'Customer not found'
      });
    }

    // Insert loan application
    const insertSql = `
      INSERT INTO loan_applications
      (customer_id, loan_type, loan_amount, interest_rate, tenure_months)
      VALUES (?, ?, ?, ?, ?)
    `;

    db.query(
      insertSql,
      [customer_id, loan_type, loan_amount, interest_rate, tenure_months],
      (err, result) => {
        if (err) return res.status(500).json(err);

        res.status(201).json({
          message: 'Loan application submitted successfully',
          application_id: result.insertId,
          status: 'PENDING'
        });
      }
    );
  });
});


// Approve loan application
app.put('/loan-applications/:id/approve', (req, res) => {
  const applicationId = req.params.id;

  // Check application exists
  const checkSql = `
    SELECT * FROM loan_applications
    WHERE application_id = ?
  `;

  db.query(checkSql, [applicationId], (err, result) => {
    if (err) return res.status(500).json(err);

    if (result.length === 0) {
      return res.status(404).json({
        message: 'Loan application not found'
      });
    }

    if (result[0].status !== 'PENDING') {
      return res.status(400).json({
        message: 'Only pending applications can be approved'
      });
    }

    // Update status
    const updateSql = `
      UPDATE loan_applications
      SET status = 'APPROVED'
      WHERE application_id = ?
    `;

    db.query(updateSql, [applicationId], (err) => {
      if (err) return res.status(500).json(err);

      res.json({
        message: 'Loan application approved successfully',
        application_id: applicationId,
        status: 'APPROVED'
      });
    });
  });
});

// Sanction loan and create loan account
app.post('/loan-applications/:id/sanction', (req, res) => {
  const applicationId = req.params.id;

  const sql = `
    SELECT *
    FROM loan_applications
    WHERE application_id = ?
  `;

  db.query(sql, [applicationId], (err, result) => {
    if (err) return res.status(500).json(err);

    if (result.length === 0) {
      return res.status(404).json({
        message: 'Loan application not found'
      });
    }

    const appData = result[0];

    if (appData.status !== 'APPROVED') {
      return res.status(400).json({
        message: 'Loan must be approved before sanction'
      });
    }

    const P = parseFloat(appData.loan_amount);
    const annualRate = parseFloat(appData.interest_rate);
    const n = parseInt(appData.tenure_months);

    const r = annualRate / 12 / 100;

    // EMI calculation
    const emi =
      P * r * Math.pow(1 + r, n) /
      (Math.pow(1 + r, n) - 1);

    const emiAmount = emi.toFixed(2);

    const sanctionDate = new Date();

    const maturityDate = new Date();
    maturityDate.setMonth(maturityDate.getMonth() + n);

    const insertSql = `
      INSERT INTO loan_accounts
      (
        application_id,
        customer_id,
        sanctioned_amount,
        interest_rate,
        tenure_months,
        emi_amount,
        sanction_date,
        maturity_date
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
      insertSql,
      [
        appData.application_id,
        appData.customer_id,
        P,
        annualRate,
        n,
        emiAmount,
        sanctionDate,
        maturityDate
      ],
      (err, insertResult) => {
        if (err) return res.status(500).json(err);

        res.json({
          message: 'Loan sanctioned successfully',
          loan_account_id: insertResult.insertId,
          emi_amount: emiAmount,
          sanction_date: sanctionDate.toISOString().split('T')[0],
          maturity_date: maturityDate.toISOString().split('T')[0]
        });
      }
    );
  });
});

// Generate EMI schedule
app.post('/loan-accounts/:id/generate-emi', (req, res) => {
  const loanAccountId = req.params.id;

  // Get loan account details
  const sql = `
    SELECT *
    FROM loan_accounts
    WHERE loan_account_id = ?
  `;

  db.query(sql, [loanAccountId], (err, result) => {
    if (err) return res.status(500).json(err);

    if (result.length === 0) {
      return res.status(404).json({
        message: 'Loan account not found'
      });
    }

    const loan = result[0];

    const emiAmount = parseFloat(loan.emi_amount);
    const tenure = parseInt(loan.tenure_months);
    const sanctionedAmount = parseFloat(loan.sanctioned_amount);
    const annualRate = parseFloat(loan.interest_rate);

    // Approximate principal and interest split
    const principalPerMonth = sanctionedAmount / tenure;
    const monthlyRate = annualRate / 12 / 100;

    let balance = sanctionedAmount;

    const emiRecords = [];

    for (let i = 1; i <= tenure; i++) {

      const interestComponent = balance * monthlyRate;
      const principalComponent = emiAmount - interestComponent;

      balance = balance - principalComponent;

      const dueDate = new Date(loan.sanction_date);
      dueDate.setMonth(dueDate.getMonth() + i);

      emiRecords.push([
        loanAccountId,
        i,
        dueDate,
        emiAmount.toFixed(2),
        principalComponent.toFixed(2),
        interestComponent.toFixed(2)
      ]);
    }

    const insertSql = `
      INSERT INTO emi_schedule
      (
        loan_account_id,
        emi_no,
        due_date,
        emi_amount,
        principal_component,
        interest_component
      )
      VALUES ?
    `;

    db.query(insertSql, [emiRecords], (err, insertResult) => {
      if (err) return res.status(500).json(err);

      res.json({
        message: 'EMI schedule generated successfully',
        loan_account_id: loanAccountId,
        emi_count: insertResult.affectedRows
      });
    });
  });
});

// Make EMI payment
app.post('/payments', (req, res) => {
  const {
    emi_id,
    amount_paid,
    payment_mode,
    transaction_ref
  } = req.body;

  // Validation
  if (!emi_id || !amount_paid || !payment_mode || !transaction_ref) {
    return res.status(400).json({
      message: 'All fields are required'
    });
  }

  // Get EMI details
  const checkSql = `
    SELECT *
    FROM emi_schedule
    WHERE emi_id = ?
  `;

  db.query(checkSql, [emi_id], (err, result) => {
    if (err) return res.status(500).json(err);

    if (result.length === 0) {
      return res.status(404).json({
        message: 'EMI not found'
      });
    }

    const emi = result[0];

    // Prevent duplicate payment
    if (emi.status === 'PAID') {
      return res.status(400).json({
        message: 'EMI already paid'
      });
    }

    // Insert payment
    const insertSql = `
      INSERT INTO payments
      (
        emi_id,
        payment_date,
        amount_paid,
        payment_mode,
        transaction_ref
      )
      VALUES (?, CURDATE(), ?, ?, ?)
    `;

    db.query(
      insertSql,
      [emi_id, amount_paid, payment_mode, transaction_ref],
      (err, paymentResult) => {
        if (err) return res.status(500).json(err);

        // Update EMI status
        const updateSql = `
          UPDATE emi_schedule
          SET status = 'PAID'
          WHERE emi_id = ?
        `;

        db.query(updateSql, [emi_id], (err) => {
          if (err) return res.status(500).json(err);

          res.json({
            message: 'EMI payment successful',
            payment_id: paymentResult.insertId,
            emi_id: emi_id,
            amount_paid: amount_paid,
            status: 'PAID'
          });
        });
      }
    );
  });
});

// Overdue EMI report
app.get('/reports/overdue', (req, res) => {

  const sql = `
    SELECT
      e.emi_id,
      e.emi_no,
      e.due_date,
      e.emi_amount,
      c.customer_name,
      l.loan_account_id
    FROM emi_schedule e
    JOIN loan_accounts l
      ON e.loan_account_id = l.loan_account_id
    JOIN customers c
      ON l.customer_id = c.customer_id
    WHERE e.status != 'PAID'
      AND e.due_date < CURDATE()
    ORDER BY e.due_date
  `;

  db.query(sql, (err, result) => {
    if (err) return res.status(500).json(err);

    res.json(result);
  });
});

// Customer loan history
app.get('/reports/customer/:id', (req, res) => {

  const customerId = req.params.id;

  const sql = `
    SELECT
      c.customer_name,
      l.loan_account_id,
      l.sanctioned_amount,
      l.emi_amount,
      l.loan_status,
      e.emi_no,
      e.due_date,
      e.status AS emi_status
    FROM customers c
    JOIN loan_accounts l
      ON c.customer_id = l.customer_id
    LEFT JOIN emi_schedule e
      ON l.loan_account_id = e.loan_account_id
    WHERE c.customer_id = ?
    ORDER BY e.emi_no
  `;

  db.query(sql, [customerId], (err, result) => {
    if (err) return res.status(500).json(err);

    res.json(result);
  });
});

// Portfolio summary dashboard
app.get('/reports/dashboard', (req, res) => {

  const sql = `
    SELECT
      COUNT(*) AS total_loans,
      SUM(sanctioned_amount) AS total_sanctioned_amount,
      SUM(CASE WHEN loan_status = 'ACTIVE' THEN 1 ELSE 0 END) AS active_loans,
      AVG(interest_rate) AS average_interest_rate
    FROM loan_accounts
  `;

  db.query(sql, (err, result) => {
    if (err) return res.status(500).json(err);

    res.json(result[0]);
  });
});


// Start server
app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});