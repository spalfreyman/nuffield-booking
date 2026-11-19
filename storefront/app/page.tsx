import Link from 'next/link';
export default function Home() {
  return (
    <main>
      <header className="site"><div className="wrap"><span className="logo">Nuffield Health</span><span className="muted">Demo booking system</span></div></header>
      <section className="hero"><div className="wrap">
        <div className="hero-card">
          <h1>Health assessments</h1>
          <p>Personalised health checks with support for a whole year. Book online in minutes.</p>
          <Link className="btn primary" href="/book">Book a health assessment ›</Link>
          <Link className="btn outline" href="/book?family=physio">Book physiotherapy ›</Link>
        </div>
      </div></section>
      <section className="wrap" style={{ padding: '40px 0' }}>
        <h2>What&apos;s included</h2>
        <ul className="ticks">
          <li>Time with a Nuffield Health doctor and/or physiologist</li>
          <li>Results discussed face-to-face on the day</li>
          <li>Written personalised report within two weeks</li>
          <li>Free 30-day gym pass</li>
        </ul>
        <p className="muted">Mock calendar and demo catalogue. Prices marked as placeholder in <code>data/products-services.json</code>.</p>
      </section>
    </main>
  );
}
