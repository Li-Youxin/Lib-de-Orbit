import Link from 'next/link';
export default function NotFound() {
  return <main className="not-found"><span className="micro">404 / ARCHIVE</span><h1>Record not found</h1><p>当前资料索引中未发现相符记录。</p><Link href="/">返回资料索引</Link></main>;
}
