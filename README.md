# SmartLoan360 – Digital Loan Origination & EMI Management Platform

Production-style banking backend application built with Node.js, Express.js, MySQL, and REST APIs.

## API Endpoints

### Customers
- GET /customers
- POST /customers

### Loan Applications
- POST /loan-applications
- PUT /loan-applications/:id/approve
- POST /loan-applications/:id/sanction

### Reports
- GET /reports/dashboard
- GET /reports/overdue-emis