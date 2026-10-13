import type { Request, Response } from 'express';

export default async function handler(req: Request, res: Response) {
  try {
    const { default: app } = await import('../backend/src/index.js');
    app(req, res);
  } catch (error) {
    console.error('Failed to initialize API handler', error);
    res.status(500).json({
      success: false,
      error: { message: 'Internal server error' },
    });
  }
}
