# Portfolio API

A secure backend API for a portfolio website that handles contact form submissions with email notifications.

## Features

- Contact form submission endpoint
- Email notifications (both to site owner and confirmation to sender)
- Google OAuth2 authentication for email sending
- Data encryption for secure credential storage
- reCAPTCHA Enterprise integration for spam protection
- Rate limiting to prevent abuse
- Input validation and sanitization

## Tech Stack

- Node.js with Express
- MongoDB (with Mongoose)
- Nodemailer with Google OAuth2
- Zod for validation
- Crypto for encryption/decryption
- CORS protection
- Rate limiting

## Installation

1. Clone the repository
2. Install dependencies:
