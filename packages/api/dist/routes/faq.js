"use strict";
/**
 * FAQ and Knowledge Base Routes - Module F
 * Internal staff-facing FAQ system with full-text search
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_js_1 = require("../index.js");
const rbac_js_1 = require("../middleware/rbac.js");
const pg_errors_js_1 = require("../middleware/pg-errors.js");
const input_js_1 = require("../utils/input.js");
const auditLogger_js_1 = require("../middleware/auditLogger.js");
const fail = (e, res, next) => (0, input_js_1.failWith)(e, res, next);
// Tags: up to 20 short words
const tagList = (v) => {
    if (!Array.isArray(v) || v.length > 20)
        throw (0, input_js_1.bad)('tags must be a list of at most 20 words');
    return [...new Set(v.map((t) => (0, input_js_1.text)(t, 'tag', 50, true).toLowerCase()))]; // the tag filter compares exact text, so tags are kept in lower case
};
const router = (0, express_1.Router)();
// GET /api/faq/categories - List all active FAQ categories with article count
router.get('/categories', (0, rbac_js_1.requirePermission)('communications', 'view'), async (req, res, next) => {
    try {
        const result = await index_js_1.db.query(`SELECT
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
        fail(error, res, next);
    }
});
// GET /api/faq/articles - Search and filter FAQ articles with full-text search
router.get('/articles', (0, rbac_js_1.requirePermission)('communications', 'view'), async (req, res, next) => {
    try {
        const q = req.query, search = (0, input_js_1.qtext)(q.search, 'search', 200) || '', categoryId = (0, input_js_1.has)(q.categoryId) ? (0, input_js_1.uuid)(q.categoryId, 'categoryId') : '', tags = (0, input_js_1.qtext)(q.tags, 'tags', 500) || '';
        const { size: pageSize, offset } = (0, input_js_1.paging)(q, 20, 100), page = offset / pageSize + 1;
        let query = `SELECT
      a.id, a.category_id, a.title, a.content, a.tags, a.is_published,
      a.view_count, a.helpful_count, a.not_helpful_count,
      a.created_at, a.updated_at,
      c.name as category_name
     FROM faq_articles a
     JOIN faq_categories c ON a.category_id = c.id AND c.is_active = true
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
            const tagsArray = tags.toLowerCase().split(',').map(t => t.trim()).filter(Boolean);
            query += ` AND a.tags && $${params.length + 1}`;
            params.push(tagsArray);
        }
        query += ` ORDER BY a.updated_at DESC`;
        // Pagination
        query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(pageSize, offset);
        // Build count query
        let countQuery = `SELECT COUNT(*) FROM faq_articles a JOIN faq_categories c ON a.category_id = c.id AND c.is_active = true
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
            const tagsArray = tags.toLowerCase().split(',').map(t => t.trim()).filter(Boolean);
            countQuery += ` AND a.tags && $${countParams.length + 1}`;
            countParams.push(tagsArray);
        }
        const [dataResult, countResult] = await Promise.all([
            index_js_1.db.query(query, params),
            index_js_1.db.query(countQuery, countParams),
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
    }
    catch (error) {
        fail(error, res, next);
    }
});
// GET /api/faq/articles/:id - Get single FAQ article and increment view count
router.get('/articles/:id', (0, rbac_js_1.requirePermission)('communications', 'view'), async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Article id');
        // Get article and increment view count in one query (a draft is only visible to people who may edit articles)
        const result = await index_js_1.db.query(`UPDATE faq_articles
       SET view_count = view_count + 1
       WHERE id = $1 AND (is_published = true OR $2::boolean)
       RETURNING id, category_id, title, content, tags, is_published,
                 view_count, helpful_count, not_helpful_count,
                 created_at, updated_at`, [id, (0, rbac_js_1.hasPermission)(req.userRole, 'communications', 'edit')]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Article not found' });
        }
        // Fetch category name
        const article = result.rows[0];
        const categoryResult = await index_js_1.db.query(`SELECT name FROM faq_categories WHERE id = $1`, [article.category_id]);
        res.json({
            success: true,
            data: {
                ...article,
                category_name: categoryResult.rows[0]?.name || null,
            },
        });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// POST /api/faq/articles - Create new FAQ article
router.post('/articles', (0, rbac_js_1.requirePermission)('communications', 'create'), async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        if (!(0, input_js_1.has)(b.categoryId) || !(0, input_js_1.has)(b.title) || !(0, input_js_1.has)(b.content))
            throw (0, input_js_1.bad)('Missing required fields: categoryId, title, content');
        const categoryId = (0, input_js_1.uuid)(b.categoryId, 'categoryId'), title = (0, input_js_1.text)(b.title, 'title', 255, true), tags = (0, input_js_1.has)(b.tags) ? tagList(b.tags) : [];
        const content = (0, input_js_1.text)(b.content, 'content', 20000, true), isPublished = b.isPublished === undefined ? false : b.isPublished;
        if (typeof isPublished !== 'boolean')
            throw (0, input_js_1.bad)('isPublished must be true or false');
        // Same title twice is allowed (a draft and its published version share one); the category is checked in the same statement run
        const row = await (0, input_js_1.inTx)(async (c) => {
            if (!(await c.query(`SELECT 1 FROM faq_categories WHERE id = $1`, [categoryId])).rows.length)
                throw (0, input_js_1.bad)('Category not found', 404);
            return (await c.query(`INSERT INTO faq_articles (category_id, title, content, tags, is_published, created_by_user_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, category_id, title, content, tags, is_published, view_count, helpful_count, not_helpful_count, created_at`, [categoryId, title, content, tags, isPublished, req.userId])).rows[0];
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'create', 'faq_article', row.id, {}, { title, category_id: categoryId, is_published: isPublished });
        res.status(201).json({ success: true, data: row });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// PATCH /api/faq/articles/:id - Update FAQ article
router.patch('/articles/:id', (0, rbac_js_1.requirePermission)('communications', 'edit'), async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Article id'), bd = (0, input_js_1.body)(req);
        const title = (0, input_js_1.has)(bd.title) ? (0, input_js_1.text)(bd.title, 'title', 255, true) : bd.title === undefined ? undefined : (() => { throw (0, input_js_1.bad)('title is required'); })();
        const content = (0, input_js_1.has)(bd.content) ? (0, input_js_1.text)(bd.content, 'content', 20000, true) : bd.content === undefined ? undefined : (() => { throw (0, input_js_1.bad)('content is required'); })();
        const tags = bd.tags === undefined ? undefined : tagList(bd.tags), isPublished = bd.isPublished;
        if (isPublished !== undefined && typeof isPublished !== 'boolean')
            throw (0, input_js_1.bad)('isPublished must be true or false');
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
        const row = await (0, input_js_1.inTx)(async (c) => {
            const cur = (await c.query(`SELECT category_id, title, is_published FROM faq_articles WHERE id = $1 FOR UPDATE`, [id])).rows[0];
            if (!cur)
                throw (0, input_js_1.bad)('Article not found', 404);
            const upd = (await c.query(`UPDATE faq_articles SET ${updates.join(', ')} WHERE id = $${paramCount}
         RETURNING id, category_id, title, content, tags, is_published, view_count, helpful_count, not_helpful_count, updated_at`, params)).rows[0];
            return { cur, upd };
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'faq_article', id, { title: row.cur.title, is_published: row.cur.is_published }, { ...(title !== undefined && { title }), ...(content !== undefined && { content_changed: true }), ...(tags !== undefined && { tags }), ...(isPublished !== undefined && { is_published: isPublished }) });
        res.json({ success: true, data: row.upd });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// POST /api/faq/articles/:id/feedback - Record helpful/not helpful feedback
router.post('/articles/:id/feedback', (0, rbac_js_1.requirePermission)('communications', 'view'), async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Article id'), helpful = (0, input_js_1.body)(req).helpful;
        if (helpful === undefined || typeof helpful !== 'boolean') {
            return res.status(400).json({ error: 'helpful field must be boolean' });
        }
        // One vote per person: voting again does nothing, voting the other way moves the vote (the article row is locked meanwhile)
        const counts = await (0, input_js_1.inTx)(async (c) => {
            const a = (await c.query(`SELECT helpful_count, not_helpful_count FROM faq_articles WHERE id = $1 AND is_published = true FOR UPDATE`, [id])).rows[0];
            if (!a)
                throw (0, input_js_1.bad)('Article not found', 404);
            const old = (await c.query(`SELECT helpful FROM faq_article_feedback WHERE article_id = $1 AND user_id = $2`, [id, req.userId])).rows[0];
            if (old?.helpful === helpful)
                return a;
            await c.query(`INSERT INTO faq_article_feedback (article_id, user_id, helpful) VALUES ($1, $2, $3)
                     ON CONFLICT (article_id, user_id) DO UPDATE SET helpful = EXCLUDED.helpful, updated_at = NOW()`, [id, req.userId, helpful]);
            const up = helpful ? 1 : (old ? -1 : 0), down = helpful ? (old ? -1 : 0) : 1;
            return (await c.query(`UPDATE faq_articles SET helpful_count = GREATEST(helpful_count + $2, 0), not_helpful_count = GREATEST(not_helpful_count + $3, 0) WHERE id = $1
         RETURNING helpful_count, not_helpful_count`, [id, up, down])).rows[0];
        });
        res.json({ success: true, data: { articleId: id, helpful, helpful_count: counts.helpful_count, not_helpful_count: counts.not_helpful_count } });
    }
    catch (error) {
        fail(error, res, next);
    }
});
router.use(pg_errors_js_1.pgErrorHandler);
exports.default = router;
//# sourceMappingURL=faq.js.map