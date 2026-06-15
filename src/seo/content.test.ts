import { describe, expect, it } from 'vitest';
import { buildAppContent, buildHeadTags, type NearbyLink, type TideRow } from './content';
import type { StationMeta } from './meta';

const benoa: StationMeta = { name: 'Benoa', region: 'Bali', country: 'Indonesia', lat: -8.75, lon: 115.21 };
const rows: TideRow[] = [{ day: 'Mon Jun 15', time: '03:14', kind: 'High', height: '1.20 m' }];
const nearby: NearbyLink[] = [{ name: 'Sanur', slug: 'sanur-indonesia', distance: '8 km' }];

describe('buildHeadTags', () => {
  const head = buildHeadTags(benoa, 'benoa-indonesia');

  it('includes a title, description, canonical, and json-ld', () => {
    expect(head).toContain('<title>Benoa Tide Times &amp; Tide Chart — Lunitidal</title>');
    expect(head).toContain('name="description"');
    expect(head).toContain('<link rel="canonical" href="https://www.lunitidal.app/tides/benoa-indonesia/" />');
    expect(head).toContain('application/ld+json');
    expect(head).toContain('og:title');
  });

  it('neutralises a `</script>` in a station name so the json-ld can\'t break out', () => {
    const evil = buildHeadTags({ ...benoa, name: 'Evil</script><script>alert(1)' }, 'evil');
    // The raw closing tag must not survive inside the ld+json block.
    expect(evil).not.toContain('</script><script>');
    expect(evil).toContain('\\u003c'); // escaped `<`
    // The json-ld payload is still valid JSON after un-escaping.
    const json = evil.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] ?? '';
    expect(() => JSON.parse(json)).not.toThrow();
  });
});

describe('buildAppContent', () => {
  const content = buildAppContent(benoa, rows, nearby, {
    datumLabel: 'LAT',
    sourceName: 'TICON-4',
    referenceDay: 'Mon Jun 15',
  });

  it('renders an h1, the tide rows, and crawlable nearby links', () => {
    expect(content).toContain('<h1>Benoa Tide Times');
    expect(content).toContain('Benoa, Bali, Indonesia');
    expect(content).toContain('1.20 m');
    expect(content).toContain('<a href="/tides/sanur-indonesia/">Sanur</a>');
    expect(content).toContain('href="/"');
  });

  it('escapes HTML-significant characters in station names', () => {
    const evil = buildAppContent({ ...benoa, name: 'A & B <x>' }, [], [], {
      datumLabel: 'MSL',
      sourceName: 'src',
      referenceDay: 'today',
    });
    expect(evil).toContain('A &amp; B &lt;x&gt;');
    expect(evil).not.toContain('<x>');
  });
});
