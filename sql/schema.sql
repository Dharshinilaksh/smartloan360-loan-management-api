CREATE DATABASE loan_mgmt_db;
USE loan_mgmt_db;

-- 1. Customers
CREATE TABLE customers (
    customer_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_name VARCHAR(100) NOT NULL,
    phone VARCHAR(15),
    email VARCHAR(100),
    city VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Loan Applications
CREATE TABLE loan_applications (
    application_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    loan_type VARCHAR(50),
    loan_amount DECIMAL(12,2),
    interest_rate DECIMAL(5,2),
    tenure_months INT,
    application_date DATE DEFAULT (CURRENT_DATE),
    status ENUM('PENDING','APPROVED','REJECTED') DEFAULT 'PENDING',
    remarks VARCHAR(255),
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);

-- 3. Loan Accounts
CREATE TABLE loan_accounts (
    loan_account_id INT AUTO_INCREMENT PRIMARY KEY,
    application_id INT NOT NULL,
    customer_id INT NOT NULL,
    sanctioned_amount DECIMAL(12,2),
    interest_rate DECIMAL(5,2),
    tenure_months INT,
    emi_amount DECIMAL(12,2),
    sanction_date DATE,
    maturity_date DATE,
    loan_status ENUM('ACTIVE','CLOSED') DEFAULT 'ACTIVE',
    FOREIGN KEY (application_id) REFERENCES loan_applications(application_id),
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);

-- 4. EMI Schedule
CREATE TABLE emi_schedule (
    emi_id INT AUTO_INCREMENT PRIMARY KEY,
    loan_account_id INT NOT NULL,
    emi_no INT,
    due_date DATE,
    emi_amount DECIMAL(12,2),
    principal_component DECIMAL(12,2),
    interest_component DECIMAL(12,2),
    status ENUM('PENDING','PAID','OVERDUE') DEFAULT 'PENDING',
    FOREIGN KEY (loan_account_id) REFERENCES loan_accounts(loan_account_id)
);

-- 5. Payments
CREATE TABLE payments (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    emi_id INT NOT NULL,
    payment_date DATE,
    amount_paid DECIMAL(12,2),
    payment_mode VARCHAR(20),
    transaction_ref VARCHAR(50),
    FOREIGN KEY (emi_id) REFERENCES emi_schedule(emi_id)
);



