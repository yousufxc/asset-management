import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Us — KYNZi",
};

export default function AboutPage() {
  return (
    <>
      <h2>About Us</h2>

      <div className="card">
        <h1 style={{ margin: 0, textAlign: "center", fontSize: 28, letterSpacing: 1 }}>
          Welcome to KYNZi
        </h1>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>The Story of KYNZi</h3>
        <p style={{ lineHeight: 1.8, fontSize: 15 }}>
          In classical Arabic, the word{" "}
          <strong>
            <em>Kanz</em> (كنز)
          </strong>{" "}
          translates to a deeply held, highly valued treasure. It represents more than just a
          number on a balance sheet; it signifies assets of enduring value, stability, and
          heritage—wealth built through foresight, calculation, and vision.
        </p>
        <p style={{ lineHeight: 1.8, fontSize: 15 }}>
          By adding a personal touch, we created{" "}
          <strong>KYNZi</strong>, which translates directly
          to &ldquo;My Treasure.&rdquo;
        </p>
        <p style={{ lineHeight: 1.8, fontSize: 15 }}>
          We chose this name because we believe that managing your portfolio shouldn&rsquo;t
          feel like staring at a sterile corporate ledger or fighting with a messy
          spreadsheet. Whether you are expanding a footprint in brick-and-mortar real estate
          or capturing global market value through commodities, your portfolio is your
          hard-earned treasure.
        </p>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Our Philosophy</h3>
        <p style={{ lineHeight: 1.8, fontSize: 15 }}>
          KYNZi was born out of a simple realization: the tools available to independent
          investors were either overly complex institutional platforms or overly simplistic
          retail trackers. We wanted to build something different.
        </p>
        <p style={{ lineHeight: 1.8, fontSize: 15 }}>
          Our mission is to empower individuals to take absolute ownership and control of
          their wealth. We believe that with the right analytical tools, anyone can manage
          their personal assets with the precision of a private family office.
        </p>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>The Digital Vault</h3>
        <p style={{ lineHeight: 1.8, fontSize: 15 }}>
          Designed for those who appreciate both form and functionality, KYNZi bridges the
          gap between fast-moving commodities and localized real estate. It acts as your
          private digital vault—delivering sophisticated KPIs, rich visual analytics, and
          absolute clarity.
        </p>
        <p
          style={{
            lineHeight: 1.8,
            fontSize: 15,
            fontWeight: 600,
            fontStyle: "italic",
            textAlign: "center",
            marginTop: 24,
          }}
        >
          Your wealth is personal. The way you manage it should be exceptional. Welcome to
          KYNZi.
        </p>
      </div>
    </>
  );
}
