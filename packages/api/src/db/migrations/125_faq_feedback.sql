-- One helpful / not helpful vote per person per FAQ article (the counters on faq_articles used to rise on every click, so one person could push them as high as they liked). Safe to run twice.
CREATE TABLE IF NOT EXISTS faq_article_feedback (
  article_id UUID NOT NULL REFERENCES faq_articles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  helpful BOOLEAN NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (article_id, user_id)
);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rof_app') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON faq_article_feedback TO rof_app';
  END IF;
END $$;
