/**
 * FAQ and Knowledge Base Routes - Module F
 * Internal staff-facing FAQ system with full-text search
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../index.js';
import { AuthRequest } from '../index.js';
import { requirePermission, hasPermission } from '../middleware/rbac.js';
import { pgErrorHandler } from '../middleware/pg-errors.js';
import { bad, failWith, uuid, has, text, body, paging, qtext } from '../utils/input.js';

const fail = (e: any, res: Response, next: NextFunction) => failWith(e, res, next);
// Tags: up to 20 short words
const tagList = (v: any): string[] => {
  if (!Array.isArray(v) || v.length > 20) throw bad('tags must be a list of at most 20 words');
  return v.map((t) => text(t, 'tag', 50, true) as string);
};

const router = Router();

// GET /api/faq/categories - List all active FAQ categories with article count
router.get('/categories', requirePermission('communications', 'view'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      `SELECT
        c.id, c.name, c.description, c.sort_order, c.is_active,
        COUNT(a.id) as article_count
       FROM faq_categories c
       LEFT JOIN faq_articles a ON c.id = a.category_id AND a.is_published = true
       WHERE c.is_active = true
       GROUP BY c.id
       ORDER BY c.sort_order ASC`
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) { fail(error, res, next); }
});

// GET /api/faq/articles - Search and filter FAQ articles with full-text search
router.get('/articles', requirePermission('communications', 'view'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = req.query, search = qtext(q.search, 'search', 200) || '', categoryId = has(q.categoryId) ? uuid(q.categoryId, 'categoryId') : '', tags = qtext(q.tags, 'tags', 500) || '';
    const { size: pageSize, offset } = paging(q, 20, 100), page = offset / pageSize + 1;

    let query = `SELECT
      a.id, a.category_id, a.title, a.content, a.tags, a.is_published,
      a.view_count, a.helpful_count, a.not_helpful_count,
      a.created_at, a.updated_at,
      c.name as category_name
     FROM faq_articles a
     JOIN faq_categories c ON a.category_id = c.id
     WHERE a.is_published = true`;

    const params: any[] = [];

    // Full-text search using PostgreSQL tsvector
    if (search) {
      query += ` AND to_tsvector('english', a.title || ' ' || a.content) @@ plainto_tsquery('english', $${params.length + 1})`;
      params.push(search);
    }

    // Filter by category
    if (categoryId) {
      query += ` AND a.category_id = $${params.length + 1}`;
      params.push(categoryId);
    }

    // Filter by tags (array overlap)
    if (tags) {
      const tagsArray = (tags as string).split(',').map(t => t.trim());
      query += ` AND a.tags && $${params.length + 1}`;
      params.push(tagsArray);
    }

    query += ` ORDER BY a.updated_at DESC`;

    // Pagination
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(pageSize, offset);

    // Build count query
    let countQuery = `SELECT COUNT(*) FROM faq_articles a
                      WHERE a.is_published = true`;
    const countParams: any[] = [];

    if (search) {
      countQuery += ` AND to_tsvector('english', a.title || ' ' || a.content) @@ plainto_tsquery('english', $${countParams.length + 1})`;
      countParams.push(search);
    }

    if (categoryId) {
      countQuery += ` AND a.category_id = $${countParams.length + 1}`;
      countParams.push(categoryId);
    }

    if (tags) {
      const tagsArray = (tags as string).split(',').map(t => t.trim());
      countQuery += ` AND a.tags && $${countParams.length + 1}`;
      countParams.push(tagsArray);
    }

    const [dataResult, countResult] = await Promise.all([
      db.query(query, params),
      db.query(countQuery, countParams),
    ]);

    res.json({
      success: true,
      data: dataResult.rows,
      pagination: {
        page,
        pageSize,
        total: parseInt(countResult.rows[0].count),
      },
    });
  } catch (error) { fail(error, res, next); }
});

// GET /api/faq/articles/:id - Get single FAQ article and increment view count
router.get('/articles/:id', requirePermission('communications', 'view'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = uuid(req.params.id, 'Article id');

    // Get article and increment view count in one query (a draft is only visible to people who may edit articles)
    const result = await db.query(
      `UPDATE faq_articles
       SET view_count = view_count + 1
       WHERE id = $1 AND (is_published = true OR $2::boolean)
       RETURNING id, category_id, title, content, tags, is_published,
                 view_count, helpful_count, not_helpful_count,
                 created_at, updated_at`,
      [id, hasPermission(req.userRole, 'communications', 'edit')]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // Fetch category name
    const article = result.rows[0];
    const categoryResult = await db.query(
      `SELECT name FROM faq_categories WHERE id = $1`,
      [article.category_id]
    );

    res.json({
      success: true,
      data: {
        ...article,
        category_name: categoryResult.rows[0]?.name || null,
      },
    });
  } catch (error) { fail(error, res, next); }
});

// POST /api/faq/articles - Create new FAQ article
router.post('/articles', requirePermission('communications', 'create'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const b = body(req);
    if (!has(b.categoryId) || !has(b.title) || !has(b.content)) throw bad('Missing required fields: categoryId, title, content');
    const categoryId = uuid(b.categoryId, 'categoryId'), title = text(b.title, 'title', 255, true), tags = has(b.tags) ? tagList(b.tags) : [];
    const content = text(b.content, 'content', 20000, true), isPublished = b.isPublished === undefined ? false : b.isPublished;
    if (typeof isPublished !== 'boolean') throw bad('isPublished must be true or false');

    // Verify category exists
    const categoryCheck = await db.query(
      `SELECT id FROM faq_categories WHERE id = $1`,
      [categoryId]
    );

    if (categoryCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const result = await db.query(
      `INSERT INTO faq_articles (category_id, title, content, tags, is_published, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, category_id, title, content, tags, is_published, view_count, helpful_count, not_helpful_count, created_at`,
      [categoryId, title, content, tags, isPublished, req.userId]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) { fail(error, res, next); }
});

// PATCH /api/faq/articles/:id - Update FAQ article
router.patch('/articles/:id', requirePermission('communications', 'edit'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = uuid(req.params.id, 'Article id'), bd = body(req);
    const title = has(bd.title) ? text(bd.title, 'title', 255, true) : bd.title === undefined ? undefined : (() => { throw bad('title is required'); })();
    const content = has(bd.content) ? text(bd.content, 'content', 20000, true) : bd.content === undefined ? undefined : (() => { throw bad('content is required'); })();
    const tags = bd.tags === undefined ? undefined : tagList(bd.tags), isPublished = bd.isPublished;
    if (isPublished !== undefined && typeof isPublished !== 'boolean') throw bad('isPublished must be true or false');

    // Build dynamic update query
    const updates: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      params.push(title);
    }

    if (content !== undefined) {
      updates.push(`content = $${paramCount++}`);
      params.push(content);
    }

    if (tags !== undefined) {
      updates.push(`tags = $${paramCount++}`);
      params.push(tags);
    }

    if (isPublished !== undefined) {
      updates.push(`is_published = $${paramCount++}`);
      params.push(isPublished);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_by_user_id = $${paramCount++}`);
    params.push(req.userId);
    updates.push(`updated_at = NOW()`);

    params.push(id);

    const result = await db.query(
      `UPDATE faq_articles
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING id, category_id, title, content, tags, is_published, view_count, helpful_count, not_helpful_count, updated_at`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) { fail(error, res, next); }
});

// POST /api/faq/articles/:id/feedback - Record helpful/not helpful feedback
router.post('/articles/:id/feedback', requirePermission('communications', 'view'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = uuid(req.params.id, 'Article id'), helpful = body(req).helpful;

    if (helpful === undefined || typeof helpful !== 'boolean') {
      return res.status(400).json({ error: 'helpful field must be boolean' });
    }

    const updateField = helpful ? 'helpful_count' : 'not_helpful_count';

    const result = await db.query(
      `UPDATE faq_articles
       SET ${updateField} = ${updateField} + 1
       WHERE id = $1 AND is_published = true
       RETURNING id, helpful_count, not_helpful_count`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }

    res.json({
      success: true,
      data: {
        articleId: result.rows[0].id,
        helpful: helpful,
        helpful_count: result.rows[0].helpful_count,
        not_helpful_count: result.rows[0].not_helpful_count,
      },
    });
  } catch (error) { fail(error, res, next); }
});

router.use(pgErrorHandler);
export default router;
