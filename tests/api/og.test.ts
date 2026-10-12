import { describe, it, expect } from 'vitest';
import { ogQuerySchema, parseSearchParams, mergeOgParams } from '@/lib/api-validation';
import { getTemplate } from '@/templates/registry';

describe('OG API Validation', () => {
  it('should validate valid params', () => {
    const result = ogQuerySchema.safeParse({
      title: 'Hello World',
      template: 'blog-minimal-dark',
    });
    expect(result.success).toBe(true);
  });

  it('should allow missing title (template defaults supply it)', () => {
    const result = ogQuerySchema.safeParse({
      template: 'blog-minimal-dark',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBeUndefined();
    }
  });

  it('should accept an explicitly empty title and treat it as not provided', () => {
    const result = ogQuerySchema.safeParse({
      title: '',
      template: 'blog-minimal-dark',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      // empty string passes through as-is; mergeOgParams skips empty values so
      // the template default title will be used at render time
      expect(result.data.title).toBe('');
    }
  });

  it('should use defaults for optional params', () => {
    const result = ogQuerySchema.safeParse({
      title: 'Test',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.template).toBe('blog-minimal-dark');
      expect(result.data.width).toBe(1200);
      expect(result.data.height).toBe(630);
    }
  });

  it('should coerce width and height to numbers', () => {
    const result = ogQuerySchema.safeParse({
      title: 'Test',
      width: '800',
      height: '400',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.width).toBe(800);
      expect(result.data.height).toBe(400);
    }
  });

  it('should reject invalid dimensions', () => {
    const result = ogQuerySchema.safeParse({
      title: 'Test',
      width: '50', // too small
    });
    expect(result.success).toBe(false);
  });
});

describe('mergeOgParams', () => {
  const defaults: Record<string, string | number | boolean> = {
    quote: 'Default quote',
    author: 'Default Author',
    bgColor: '#0a0a0a',
  };

  function merge(query: string, templateDefaults: Record<string, string | number | boolean> = defaults) {
    const searchParams = new URLSearchParams(query);
    const parsed = parseSearchParams(searchParams, ogQuerySchema);
    expect(parsed.success).toBe(true);
    if (!parsed.success) throw new Error(parsed.error);
    return mergeOgParams(parsed.data, templateDefaults, searchParams);
  }

  it('overrides template defaults with non-empty schema params', () => {
    const merged = merge('author=Ada%20Lovelace');
    expect(merged.author).toBe('Ada Lovelace');
  });

  it('empty schema values never replace defaults', () => {
    const merged = merge('author=&bgColor=');
    expect(merged.author).toBe('Default Author');
    expect(merged.bgColor).toBe('#0a0a0a');
  });

  it('template-specific query params override template defaults', () => {
    const merged = merge('quote=Custom%20quote');
    expect(merged.quote).toBe('Custom quote');
  });

  it('empty template-specific values never replace defaults', () => {
    const merged = merge('quote=');
    expect(merged.quote).toBe('Default quote');
  });

  it('passes through template-specific params that have no default', () => {
    const merged = merge('authorTitle=Computer%20Scientist');
    expect(merged.authorTitle).toBe('Computer Scientist');
  });

  it('renders quote-centered-serif without a title param', () => {
    const template = getTemplate('quote-centered-serif');
    expect(template).toBeDefined();
    const merged = merge('template=quote-centered-serif', template!.defaults);
    expect(merged.title).toBeUndefined();
    expect(merged.quote).toBe(template!.defaults.quote);
    expect(() => template!.render(merged)).not.toThrow();
  });

  it('renders developer-portfolio-card without a title param', () => {
    const template = getTemplate('developer-portfolio-card');
    expect(template).toBeDefined();
    const merged = merge('template=developer-portfolio-card', template!.defaults);
    expect(merged.title).toBeUndefined();
    expect(merged.name).toBe(template!.defaults.name);
    expect(() => template!.render(merged)).not.toThrow();
  });

  it('quote-centered-serif query overrides template-specific defaults', () => {
    const template = getTemplate('quote-centered-serif');
    expect(template).toBeDefined();
    const merged = merge(
      'template=quote-centered-serif&quote=Talk is cheap, show me the code.',
      template!.defaults
    );
    expect(merged.quote).toBe('Talk is cheap, show me the code.');
    expect(merged.author).toBe(template!.defaults.author);
  });
});
