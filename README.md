# SnapList API

Backend API for the SnapList iOS app, which allows users to scan items, create marketplace listings automatically, and track profits.

## Features

- User management
- Image processing and analysis using OpenAI Vision
- Automatic listing creation on eBay and Facebook Marketplace
- Automatic price reduction for unsold items
- Profit tracking
- Notification system

## Tech Stack

- Node.js/Express.js
- Supabase (PostgreSQL)
- OpenAI API
- eBay API
- Facebook Marketplace API
- Vercel for deployment

## Getting Started

### Prerequisites

- Node.js 16+
- npm or yarn
- Supabase account
- OpenAI API key
- eBay Developer account
- Facebook Developer account

### Installation

1. Clone the repository
   ```
   git clone https://github.com/yourusername/snaplist.git
   cd snaplist/SnapList-api
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Create a `.env` file based on `.env.example`
   ```
   cp .env.example .env
   ```

4. Fill in the environment variables in `.env` with your API keys and credentials

5. Start the development server
   ```
   npm run dev
   ```

## API Endpoints

### Users

- `POST /api/users` - Create a new user
- `GET /api/users/:id` - Get a user by ID
- `PUT /api/users/:id` - Update a user
- `GET /api/users/:id/stats` - Get user statistics
- `GET /api/users/:id/notifications` - Get user notifications
- `POST /api/users/:id/notifications/read` - Mark all notifications as read

### Listings

- `GET /api/listings` - Get all listings for a user
- `GET /api/listings/:id` - Get a specific listing
- `POST /api/listings` - Create a new listing
- `PUT /api/listings/:id` - Update a listing
- `DELETE /api/listings/:id` - Delete a listing
- `GET /api/listings/:id/check-sold` - Check if a listing has been sold
- `POST /api/listings/:id/reduce-price` - Manually trigger a price reduction

### Profits

- `GET /api/profits` - Get all profits for a user
- `GET /api/profits/:id` - Get a specific profit
- `PUT /api/profits/:id` - Update a profit's status
- `GET /api/profits/summary` - Get a summary of profits for a user

### Images

- `POST /api/images/upload` - Upload an image
- `POST /api/images/process` - Process an image to detect objects
- `POST /api/images/analyze` - Analyze an image and generate listing details
- `DELETE /api/images/:filename` - Delete an uploaded image

## Deployment

The API is configured for deployment on Vercel. To deploy:

1. Install Vercel CLI
   ```
   npm install -g vercel
   ```

2. Deploy to Vercel
   ```
   vercel
   ```

## License

This project is licensed under the MIT License.

## Contact

For questions or support, please contact the project maintainer. 
