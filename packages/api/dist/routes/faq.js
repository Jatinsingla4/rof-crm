/**
 * FAQ and Knowledge Base Routes - Module F
 * Internal staff-facing FAQ system with full-text search
 */
import { Router } from 'express';
import { db } from '../index.js';
import { requirePermission } from '../middleware/rbac.js';
const router = Router();
// GET /api/faq/categories - List all active FAQ categories with article count
router.get('/categories', requirePermission('communications', 'view'), async (req, res, next) => {
    try {
        const result = await db.query(`SELECT
        c.id, c.name, c.description, c.sort_order, c.is_active,
        COUNT(a.id) as article_count
       FROM faq_categories c
       LEFT JOIN faq_articles a ON c.id = a.category_id AND a.is_published = true
       WHERE c.is_active = true
       GROUP BY c.id
       ORDER BY c.sort_order ASC`);
        res.json({
            success: true,
            data: result.rows,
        });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/faq/articles - Search and filter FAQ articles with full-text search
router.get('/articles', requirePermission('communications', 'view'), async (req, res, next) => {
    try {
        const { search = '', categoryId = '', tags = '', page = 1, pageSize = 20 } = req.query;
        let query = `SELECT
      a.id, a.category_id, a.title, a.content, a.tags, a.is_published,
      a.view_count, a.helpful_count, a.not_helpful_count,
      a.created_at, a.updated_at,
      c.name as category_name
     FROM faq_articles a
     JOIN faq_categories c ON a.category_id = c.id
     WHERE a.is_published = true`;
        const params = [];
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
            const tagsArray = tags.split(',').map(t => t.trim());
            query += ` AND a.tags && $${params.length + 1}`;
            params.push(tagsArray);
        }
        query += ` ORDER BY a.updated_at DESC`;
        // Pagination
        const offset = (page - 1) * pageSize;
        query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(pageSize, offset);
        // Build count query
        let countQuery = `SELECT COUNT(*) FROM faq_articles a
                      WHERE a.is_published = true`;
        const countParams = [];
        if (search) {
            countQuery += ` AND to_tsvector('english', a.title || ' ' || a.content) @@ plainto_tsquery('english', $${countParams.length + 1})`;
            countParams.push(search);
        }
        if (categoryId) {
            countQuery += ` AND a.category_id = $${countParams.length + 1}`;
            countParams.push(categoryId);
        }
        if (tags) {
            const tagsArray = tags.split(',').map(t => t.trim());
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
                page: page,
                pageSize: pageSize,
                total: parseInt(countResult.rows[0].count),
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/faq/articles/:id - Get single FAQ article and increment view count
router.get('/articles/:id', requirePermission('communications', 'view'), async (req, res, next) => {
    try {
        const { id } = req.params;
        // Get article and increment view count in one query
        const result = await db.query(`UPDATE faq_articles
       SET view_count = view_count + 1
       WHERE id = $1
       RETURNING id, category_id, title, content, tags, is_published,
                 view_count, helpful_count, not_helpful_count,
                 created_at, updated_at`, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Article not found' });
        }
        // Fetch category name
        const article = result.rows[0];
        const categoryResult = await db.query(`SELECT name FROM faq_categories WHERE id = $1`, [article.category_id]);
        res.json({
            success: true,
            data: {
                ...article,
                category_name: categoryResult.rows[0]?.name || null,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/faq/articles - Create new FAQ article
router.post('/articles', requirePermission('communications', 'create'), async (req, res, next) => {
    try {
        const { categoryId, title, content, tags = [], isPublished = false } = req.body;
        // Validate required fields
        if (!categoryId || !title || !content) {
            return res.status(400).json({ error: 'Missing required fields: categoryId, title, content' });
        }
        // Verify category exists
        const categoryCheck = await db.query(`SELECT id FROM faq_categories WHERE id = $1`, [categoryId]);
        if (categoryCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }
        const result = await db.query(`INSERT INTO faq_articles (category_id, title, content, tags, is_published, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, category_id, title, content, tags, is_published, view_count, helpful_count, not_helpful_count, created_at`, [categoryId, title, content, tags, isPublished, req.userId]);
        res.status(201).json({
            success: true,
            data: result.rows[0],
        });
    }
    catch (error) {
        next(error);
    }
});
// PATCH /api/faq/articles/:id - Update FAQ article
router.patch('/articles/:id', requirePermission('communications', 'edit'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const { title, content, tags, isPublished } = req.body;
        // Build dynamic update query
        const updates = [];
        const params = [];
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
        const result = await db.query(`UPDATE faq_articles
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING id, category_id, title, content, tags, is_published, view_count, helpful_count, not_helpful_count, updated_at`, params);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Article not found' });
        }
        res.json({
            success: true,
            data: result.rows[0],
        });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/faq/articles/:id/feedback - Record helpful/not helpful feedback
router.post('/articles/:id/feedback', requirePermission('communications', 'view'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const { helpful } = req.body;
        if (helpful === undefined || typeof helpful !== 'boolean') {
            return res.status(400).json({ error: 'helpful field must be boolean' });
        }
        const updateField = helpful ? 'helpful_count' : 'not_helpful_count';
        const result = await db.query(`UPDATE faq_articles
       SET ${updateField} = ${updateField} + 1
       WHERE id = $1
       RETURNING id, helpful_count, not_helpful_count`, [id]);
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
    }
    catch (error) {
        next(error);
    }
});
export default router;
//# sourceMappingURL=faq.js.map