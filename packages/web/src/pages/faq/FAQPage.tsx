import { useState, useEffect } from 'react';
import { Card, spacing, colors } from '@rof-crm/design-system';
import { apiClient } from '../../api/client';

interface Category {
  id: string;
  name: string;
  description?: string;
  article_count?: number;
}

interface Article {
  id: string;
  category_id: string;
  category_name: string;
  title: string;
  content: string;
  tags?: string[];
  view_count: number;
  helpful_count: number;
  not_helpful_count: number;
  created_at: string;
  updated_at: string;
}

export function FAQPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingArticle, setIsLoadingArticle] = useState(false);
  const [userFeedback, setUserFeedback] = useState<{ [key: string]: boolean }>({});

  // Fetch categories on mount
  useEffect(() => {
    fetchCategories();
  }, []);

  // Fetch articles when category or search changes
  useEffect(() => {
    if (selectedCategory || searchQuery) {
      fetchArticles();
    }
  }, [selectedCategory, searchQuery]);

  const fetchCategories = async () => {
    try {
      const response = await apiClient.get('/faq/categories');
      const data = response.data;
      if (data.success) {
        setCategories(data.data);
        // Auto-select first category
        if (data.data.length > 0 && !selectedCategory) {
          setSelectedCategory(data.data[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchArticles = async () => {
    setIsLoading(true);
    try {
      const params: any = {};
      if (searchQuery) params.search = searchQuery;
      if (selectedCategory) params.categoryId = selectedCategory;
      params.pageSize = '50';

      const response = await apiClient.get('/faq/articles', { params });
      const data = response.data;
      if (data.success) {
        setArticles(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch articles:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchArticleDetail = async (articleId: string) => {
    setIsLoadingArticle(true);
    try {
      const response = await apiClient.get(`/faq/articles/${articleId}`);
      const data = response.data;
      if (data.success) {
        setSelectedArticle(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch article:', error);
    } finally {
      setIsLoadingArticle(false);
    }
  };

  const handleArticleClick = (article: Article) => {
    fetchArticleDetail(article.id);
  };

  const handleFeedback = async (helpful: boolean) => {
    if (!selectedArticle) return;

    try {
      const response = await apiClient.post(`/faq/articles/${selectedArticle.id}/feedback`, { helpful });
      const data = response.data;
      if (data.success) {
        setUserFeedback({ ...userFeedback, [selectedArticle.id]: helpful });
        // Update article view
        setSelectedArticle({
          ...selectedArticle,
          helpful_count: data.data.helpful_count,
          not_helpful_count: data.data.not_helpful_count,
        });
      }
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    }
  };

  const renderMarkdown = (text: string) => {
    // Simple markdown rendering (headings, bold, lists, tables)
    let html = text
      .replace(/^### (.*?)$/gm, '<h3 style="margin-top: 16px; margin-bottom: 8px; font-weight: 600;">$1</h3>')
      .replace(/^## (.*?)$/gm, '<h2 style="margin-top: 20px; margin-bottom: 12px; font-weight: 700; font-size: 16px;">$1</h2>')
      .replace(/^# (.*?)$/gm, '<h1 style="margin-bottom: 16px; font-weight: 700; font-size: 20px;">$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/- (.*?)$/gm, '<li style="margin-left: 20px;">$1</li>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/^\| (.*?) \|$/gm, (match) => {
        const cells = match.split('|').filter(c => c.trim());
        return `<tr>${cells.map(cell => `<td style="border: 1px solid #ddd; padding: 8px;">${cell.trim()}</td>`).join('')}</tr>`;
      });

    return <div dangerouslySetInnerHTML={{ __html: html }} style={{ lineHeight: 1.6 }} />;
  };

  return (
    <div>
      <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: spacing.lg }}>FAQ & Knowledge Base</h1>

      {/* Search Bar */}
      <Card variant="elevated" padding="spacious" style={{ marginBottom: spacing.lg }}>
        <input
          type="text"
          placeholder="Search FAQs... (e.g., 'HRERA interest', 'e-draw import')"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '14px',
            border: `1px solid ${colors.neutral[300]}`,
            borderRadius: '6px',
            fontFamily: 'inherit',
          }}
        />
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: spacing.lg }}>
        {/* Categories Sidebar */}
        <div>
          <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: spacing.md }}>Categories</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => {
                  setSelectedCategory(category.id);
                  setSearchQuery('');
                  setSelectedArticle(null);
                }}
                style={{
                  padding: '12px',
                  backgroundColor: selectedCategory === category.id ? colors.primary[500] : colors.neutral[100],
                  color: selectedCategory === category.id ? 'white' : colors.neutral[800],
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '14px',
                  fontWeight: selectedCategory === category.id ? 600 : 500,
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  if (selectedCategory !== category.id) {
                    (e.target as HTMLElement).style.backgroundColor = colors.neutral[200];
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedCategory !== category.id) {
                    (e.target as HTMLElement).style.backgroundColor = colors.neutral[100];
                  }
                }}
              >
                <div>{category.name}</div>
                <div style={{ fontSize: '12px', opacity: 0.7 }}>
                  {category.article_count || 0} articles
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Articles List or Detail View */}
        <div>
          {selectedArticle ? (
            // Article Detail View
            <Card variant="elevated" padding="spacious">
              <div style={{ marginBottom: spacing.lg }}>
                <button
                  onClick={() => setSelectedArticle(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: colors.primary[500],
                    cursor: 'pointer',
                    fontSize: '14px',
                    marginBottom: spacing.md,
                    textDecoration: 'underline',
                  }}
                >
                  ← Back to articles
                </button>
              </div>

              <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: spacing.md }}>
                {selectedArticle.title}
              </h2>

              <div style={{ fontSize: '12px', color: colors.neutral[600], marginBottom: spacing.lg }}>
                Category: <strong>{selectedArticle.category_name}</strong> • Updated: {new Date(selectedArticle.updated_at).toLocaleDateString()} • Views: {selectedArticle.view_count}
              </div>

              <div style={{ marginBottom: spacing.lg, fontSize: '14px', lineHeight: 1.8 }}>
                {renderMarkdown(selectedArticle.content)}
              </div>

              {/* Tags */}
              {selectedArticle.tags && selectedArticle.tags.length > 0 && (
                <div style={{ marginBottom: spacing.lg }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>Tags:</div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {selectedArticle.tags.map((tag) => (
                      <div
                        key={tag}
                        style={{
                          padding: '4px 12px',
                          backgroundColor: colors.neutral[200],
                          borderRadius: '4px',
                          fontSize: '12px',
                        }}
                      >
                        {tag}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Feedback Section */}
              <div style={{ borderTop: `1px solid ${colors.neutral[300]}`, paddingTop: spacing.md, marginTop: spacing.lg }}>
                <div style={{ fontSize: '14px', marginBottom: spacing.md }}>
                  Was this article helpful?
                </div>
                <div style={{ display: 'flex', gap: spacing.md }}>
                  <button
                    onClick={() => handleFeedback(true)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: userFeedback[selectedArticle.id] === true ? colors.success[500] : colors.neutral[200],
                      color: userFeedback[selectedArticle.id] === true ? 'white' : colors.neutral[800],
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    👍 Yes ({selectedArticle.helpful_count})
                  </button>
                  <button
                    onClick={() => handleFeedback(false)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: userFeedback[selectedArticle.id] === false ? colors.error[500] : colors.neutral[200],
                      color: userFeedback[selectedArticle.id] === false ? 'white' : colors.neutral[800],
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    👎 No ({selectedArticle.not_helpful_count})
                  </button>
                </div>
              </div>
            </Card>
          ) : (
            // Articles List View
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
              {isLoading ? (
                <Card variant="elevated" padding="spacious">
                  <div style={{ textAlign: 'center', color: colors.neutral[500] }}>Loading articles...</div>
                </Card>
              ) : articles.length === 0 ? (
                <Card variant="elevated" padding="spacious">
                  <div style={{ textAlign: 'center', color: colors.neutral[500] }}>
                    {searchQuery ? 'No articles found matching your search.' : 'Select a category to view articles.'}
                  </div>
                </Card>
              ) : (
                articles.map((article) => (
                  <Card
                    key={article.id}
                    variant="elevated"
                    padding="spacious"
                    style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = colors.neutral[50];
                      (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'white';
                      (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                    }}
                    onClick={() => handleArticleClick(article)}
                  >
                    <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: colors.primary[600] }}>
                      {article.title}
                    </h3>
                    <div style={{ fontSize: '12px', color: colors.neutral[600], marginBottom: '12px' }}>
                      Views: {article.view_count} • Helpful: {article.helpful_count} • Not helpful: {article.not_helpful_count}
                    </div>
                    {article.tags && article.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {article.tags.slice(0, 3).map((tag) => (
                          <div
                            key={tag}
                            style={{
                              padding: '2px 8px',
                              backgroundColor: colors.neutral[200],
                              borderRadius: '3px',
                              fontSize: '11px',
                            }}
                          >
                            {tag}
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
