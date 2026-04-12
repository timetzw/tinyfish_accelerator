import Head from 'next/head'
import { useState, useRef } from 'react'

export default function Home() {
  const [utype, setUtype] = useState('fund')
  const [delChecked, setDelChecked] = useState(false)
  const [formVisible, setFormVisible] = useState(true)
  const [sucEmail, setSucEmail] = useState('')
  const [openIds, setOpenIds] = useState({})

  const fnameRef = useRef(null)
  const emailRef = useRef(null)

  function setType(t){
    setUtype(t)
    setDelChecked(false)
  }

  function toggleDel(){
    setDelChecked(v => !v)
  }

  function submitForm(){
    const e = (emailRef.current?.value || '').trim()
    const f = (fnameRef.current?.value || '').trim()
    if(!f || !e || !e.includes('@')){
      const el = emailRef.current
      if(el){
        el.style.borderColor = 'var(--terracotta)'
        el.focus()
        setTimeout(()=>{ el.style.borderColor = '' }, 2000)
      }
      return
    }
    setFormVisible(false)
    setSucEmail(e)
  }

  function toggleR(id){
    setOpenIds(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <>
      <Head>
        <title>Consul.AI</title>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1.0" />
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Jost:wght@300;400;500;600&display=swap" rel="stylesheet" />
      </Head>

      <nav>
        <a href="#top" className="nav-logo">
          <div className="laurel-mark">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 24 C6 20 6 12 10 9 C8 14 10 19 14 21" stroke="#8B6914" strokeWidth="1" fill="none" strokeLinecap="round"/>
              <path d="M8 24 C7 19 9 13 12 11 C10 16 12 20 15 22" stroke="#8B6914" strokeWidth="1" fill="none" strokeLinecap="round"/>
              <path d="M24 24 C26 20 26 12 22 9 C24 14 22 19 18 21" stroke="#8B6914" strokeWidth="1" fill="none" strokeLinecap="round"/>
              <path d="M24 24 C25 19 23 13 20 11 C22 16 20 20 17 22" stroke="#8B6914" strokeWidth="1" fill="none" strokeLinecap="round"/>
              <path d="M8 24 L16 26 L24 24" stroke="#8B6914" strokeWidth="1" fill="none" strokeLinecap="round"/>
              <circle cx="16" cy="16" r="3" stroke="#8B6914" strokeWidth="1" fill="none"/>
              <path d="M16 13 L16 10 M13.5 14.5 L11 13 M18.5 14.5 L21 13" stroke="#8B6914" strokeWidth="0.75" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="logo-wordmark">Consul<span>.AI</span></div>
        </a>
        <div className="nav-links">
          <a href="#how">How it works</a>
          <a href="#who">Who it's for</a>
          <a href="#pricing">Pricing</a>
        </div>
        <div className="nav-right">
          <a href="#register" className="btn-ghost">Sign in</a>
          <a href="#register" className="btn-solid">Request access</a>
        </div>
      </nav>

      <div id="top" style={{background:'var(--parchment)'}}>
        <div className="hero">
          <div className="hero-left">
            <div className="hero-kicker">
              <div className="kicker-rule"></div>
              <div className="kicker-text">Now accepting early access</div>
            </div>
            <h1>Proxy voting,<br/><em>aligned</em> to your<br/>philosophy.</h1>
            <p className="hero-sub">Consul.AI is an AI-powered voting agent for family offices and asset managers. We analyze every proxy filing and execute shareholder votes that reflect your investment values — not institutional defaults.</p>
            <div className="hero-ctas">
              <a href="#register" className="btn-primary">Request early access</a>
              <a href="#how" className="btn-outline">How it works</a>
            </div>
          </div>
          <div className="hero-right">
            <div className="stat-panel">
              <div className="stat-panel-head">
                <div className="sp-dot"></div><div className="sp-dot"></div><div className="sp-dot"></div>
                <div className="sp-title">Market context</div>
              </div>
              <div className="stat-grid">
                <div className="stat-cell">
                  <div className="stat-n gold">$41T</div>
                  <div className="stat-lbl">in shareholder value voted annually</div>
                </div>
                <div className="stat-cell">
                  <div className="stat-n">8,000+</div>
                  <div className="stat-lbl">S&P 500 proxy resolutions per year</div>
                </div>
                <div className="stat-cell">
                  <div className="stat-n">&lt;1%</div>
                  <div className="stat-lbl">retail shareholder engagement rate</div>
                </div>
                <div className="stat-cell">
                  <div className="stat-n gold">10×</div>
                  <div className="stat-lbl">faster than manual portal review</div>
                </div>
              </div>
            </div>
            <div className="hero-callout">
              <p><strong>Most mid-market firms rely on generic proxy advisors</strong> or skip voting entirely. Consul.AI gives you the infrastructure to vote every resolution — on your terms.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="senatus">
        <div className="senatus-inner">
          <div className="senatus-item"><span className="sen-glyph">⚷</span> TEE-secured private data</div>
          <div className="senatus-item"><span className="sen-glyph">⚷</span> SEC-aligned execution</div>
          <div className="senatus-item"><span className="sen-glyph">⚷</span> Real-time portal automation</div>
          <div className="senatus-item"><span className="sen-glyph">⚷</span> Full audit trail</div>
          <div className="senatus-item"><span className="sen-glyph">⚷</span> No institutional defaults</div>
        </div>
      </div>

      <div id="how" style={{background:'var(--parchment2)'}}>
        <div className="section-alt-bg">
          <div className="s-inner">
            <div className="s-kicker"><div className="s-kicker-line"></div><div className="s-kicker-text">Process</div></div>
            <h2 className="s-title">From filing to vote in minutes</h2>
            <p className="s-body">Consul.AI handles the entire proxy pipeline — ingesting SEC filings, learning your philosophy, and auto-filling votes — so your attention goes where judgment is actually required.</p>
            <div className="steps-grid">
              <div className="step-card">
                <div className="step-numeral">I</div>
                <div className="step-t">Register and configure</div>
                <div className="step-d">Sign up as a fund manager or financial advisor. Install the browser extension, then complete a philosophy questionnaire that maps your values and investment thesis into your private Digital Twin.</div>
              </div>
              <div className="step-card">
                <div className="step-numeral">II</div>
                <div className="step-t">AI analyzes the filings</div>
                <div className="step-d">Our system ingests proxy statements, annual reports, and ESG disclosures. Your Digital Twin — secured inside a Hardware Enclave — interprets every proposal against your specific philosophy.</div>
              </div>
              <div className="step-card">
                <div className="step-numeral">III</div>
                <div className="step-t">Extension auto-fills votes</div>
                <div className="step-d">Open all your proxy portal tabs at once. The extension detects each page and processes decisions in the background. When you tab back, your votes are pre-filled and ready to review.</div>
              </div>
              <div className="step-card">
                <div className="step-numeral">IV</div>
                <div className="step-t">Review, audit, and submit</div>
                <div className="step-d">Each pre-filled vote includes expandable reasoning inline with the form. Audit, override, or approve — then submit with a complete record of why every decision was made.</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="section" id="product">
        <div className="two-col">
          <div>
            <div className="s-kicker"><div className="s-kicker-line"></div><div className="s-kicker-text">The product</div></div>
            <h2 className="s-title">Your philosophy, encoded. Your votes, executed.</h2>
            <p className="s-body">Unlike generic proxy advisors, Consul.AI doesn't apply one-size-fits-all guidelines. Every vote is grounded in your firm's specific investment thesis — and every decision is explainable.</p>
            <ul className="feat-list">
              <li><div className="feat-pip"><svg viewBox="0 0 8 8" fill="none"><path d="M1.5 4l2 2 3-3" stroke="#8B6914" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/></svg></div>Inline rationale for every vote, expandable per proposal</li>
              <li><div className="feat-pip"><svg viewBox="0 0 8 8" fill="none"><path d="M1.5 4l2 2 3-3" stroke="#8B6914" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/></svg></div>Process dozens of tabs simultaneously — AI works while you're away</li>
              <li><div className="feat-pip"><svg viewBox="0 0 8 8" fill="none"><path d="M1.5 4l2 2 3-3" stroke="#8B6914" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/></svg></div>Hardware Enclave (TEE) keeps your philosophy model private</li>
              <li><div className="feat-pip"><svg viewBox="0 0 8 8" fill="none"><path d="M1.5 4l2 2 3-3" stroke="#8B6914" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/></svg></div>Compliance-ready audit trail, exportable per vote or per period</li>
            </ul>
          </div>
          <div className="mockup-frame">
            <div className="mf-bar">
              <div className="mf-dot"></div><div className="mf-dot"></div><div className="mf-dot"></div>
              <div className="mf-label">Consul.AI — Vote review</div>
            </div>
            <div className="mf-body">
              <div style={{fontSize:'11px',color:'var(--ink3)',marginBottom:'.875rem',fontWeight:500,letterSpacing:'.5px',textTransform:'uppercase'}}>4 proposals · 2 pending review</div>
              <div className="vote-row">
                <div style={{flex:1,minWidth:0}}>
                  <div className="v-co">Apple Inc.</div>
                  <div className="v-prop">Elect director — Laurene Powell Jobs</div>
                </div>
                <span className="v-badge vb-for">For</span>
                <button type="button" className="v-why" onClick={()=>toggleR('r1')}>Rationale</button>
              </div>
              <div className={`v-reason ${openIds['r1'] ? 'open' : ''}`} id="r1">Board diversity score meets threshold. Director tenure of 6 years aligns with your 10-year maximum policy. No conflicting committee roles detected.</div>
              <div className="vote-row">
                <div style={{flex:1,minWidth:0}}>
                  <div className="v-co">Meta Platforms</div>
                  <div className="v-prop">Advisory vote on executive compensation</div>
                </div>
                <span className="v-badge vb-against">Against</span>
                <button type="button" className="v-why" onClick={()=>toggleR('r2')}>Rationale</button>
              </div>
              <div className={`v-reason ${openIds['r2'] ? 'open' : ''}`} id="r2">CEO pay ratio of 312:1 exceeds your 200:1 threshold. Equity grants lack performance-based vesting conditions per your ESG policy.</div>
              <div className="vote-row">
                <div style={{flex:1,minWidth:0}}>
                  <div className="v-co">ExxonMobil</div>
                  <div className="v-prop">Shareholder proposal — climate risk reporting</div>
                </div>
                <span className="v-badge vb-for">For</span>
                <button type="button" className="v-why" onClick={()=>toggleR('r3')}>Rationale</button>
              </div>
              <div className={`v-reason ${openIds['r3'] ? 'open' : ''}`} id="r3">Aligns with your TCFD-aligned disclosure mandate. Similar proposals at peer companies supported in prior proxy seasons.</div>
              <div className="vote-row" style={{borderBottom:'none'}}>
                <div style={{flex:1,minWidth:0}}>
                  <div className="v-co">Berkshire Hathaway</div>
                  <div className="v-prop">Ratify auditor — Deloitte & Touche</div>
                </div>
                <span className="v-badge vb-pending">Processing</span>
                <span className="v-why" style={{color:'var(--ink3)',cursor:'default'}}>—</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="who" style={{background:'var(--parchment2)'}}>
        <div className="section-alt-bg">
          <div className="s-inner">
            <div className="s-kicker"><div className="s-kicker-line"></div><div className="s-kicker-text">Who it's for</div></div>
            <h2 className="s-title">Built for fiduciaries who take ownership seriously</h2>
            <p className="s-body">Two types of professionals rely on Consul.AI — each with their own workflow, each with votes that deserve a real decision behind them.</p>
            <div className="aud-grid">
              <div className="aud-card feat">
                <div className="aud-eyebrow">Fund Managers</div>
                <div className="aud-title">Multi-family offices &amp; asset managers</div>
                <div className="aud-body">Eliminate the operational drag of navigating fragmented custodial portals across hundreds of holdings. Vote at scale without sacrificing your edge or your values.</div>
                <ul className="aud-list">
                  <li>Multi-portal, multi-resolution automation</li>
                  <li>Custom philosophy model per fund strategy</li>
                  <li>Bulk tab processing — open all at once</li>
                  <li>Compliance audit trail export</li>
                  <li>Override and annotation tools for edge cases</li>
                </ul>
              </div>
              <div className="aud-card">
                <div className="aud-eyebrow">Financial Advisors</div>
                <div className="aud-title">RIAs &amp; independent advisors</div>
                <div className="aud-body">Offer proxy voting as a differentiated service. Fill out voting preferences on behalf of clients, or delegate the questionnaire directly to them on their own schedule.</div>
                <ul className="aud-list">
                  <li>Client questionnaire delegation flow</li>
                  <li>Vote on behalf of advisees directly</li>
                  <li>Per-client philosophy profiles</li>
                  <li>Advisor dashboard for portfolio-wide views</li>
                  <li>Branded review experience for clients</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="pricing" className="section">
        <div className="s-kicker"><div className="s-kicker-line"></div><div className="s-kicker-text">Pricing</div></div>
        <h2 className="s-title">Start free. Scale when proxy season demands it.</h2>
        <p className="s-body">No credit card required to get started. Early access members receive three months of Professional at no cost.</p>
        <div className="price-grid">
          <div className="price-card">
            <div className="p-tier">Starter</div>
            <div className="p-amt">Free</div>
            <div className="p-note">3 votes per week, always free</div>
            <hr className="p-rule"/>
            <ul className="p-feats">
              <li>3 proxy votes per week</li>
              <li>Browser extension included</li>
              <li>Philosophy questionnaire</li>
              <li>Inline vote rationale</li>
              <li className="off">Multi-portal automation</li>
              <li className="off">Client delegation</li>
              <li className="off">Audit trail export</li>
            </ul>
            <button className="btn-plan plan-out" onClick={()=>document.getElementById('register')?.scrollIntoView({behavior:'smooth'})}>Get started free</button>
          </div>
          <div className="price-card feat">
            <div className="popular-pip">Most popular</div>
            <div className="p-tier">Professional</div>
            <div className="p-amt">$149<sub>/mo</sub></div>
            <div className="p-note">Per advisor or fund seat</div>
            <hr className="p-rule"/>
            <ul className="p-feats">
              <li>Unlimited proxy votes</li>
              <li>Full multi-portal automation</li>
              <li>Advanced philosophy model</li>
              <li>Client questionnaire delegation</li>
              <li>Audit trail &amp; CSV export</li>
              <li>Priority processing queue</li>
              <li className="off">Dedicated onboarding</li>
            </ul>
            <button className="btn-plan plan-fill" onClick={()=>document.getElementById('register')?.scrollIntoView({behavior:'smooth'})}>Request early access</button>
          </div>
          <div className="price-card">
            <div className="p-tier">Enterprise</div>
            <div className="p-amt">Custom</div>
            <div className="p-note">For firms managing $1B+ AUM</div>
            <hr className="p-rule"/>
            <ul className="p-feats">
              <li>Everything in Professional</li>
              <li>Dedicated TEE infrastructure</li>
              <li>Custom philosophy ingestion</li>
              <li>White-label option</li>
              <li>API access &amp; integrations</li>
              <li>SLA guarantees</li>
              <li>Dedicated onboarding &amp; support</li>
            </ul>
            <button className="btn-plan plan-out" onClick={()=>document.getElementById('register')?.scrollIntoView({behavior:'smooth'})}>Contact sales</button>
          </div>
        </div>
      </div>

      <div id="register" className="reg-section">
        <div className="reg-inner">
          <div>
            <div className="s-kicker"><div className="s-kicker-line"></div><div className="s-kicker-text">Early access</div></div>
            <h2 className="s-title">Join the waitlist</h2>
            <p className="s-body">Be among the first fiduciaries to automate proxy season. Early members receive 3 months of Professional free, plus hands-on onboarding before the next season opens.</p>
            <div className="reg-perks">
              <div className="reg-perk">
                <div className="perk-icon"><svg viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#8B6914" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
                <div className="perk-text">3 months of Professional plan, free for early members</div>
              </div>
              <div className="reg-perk">
                <div className="perk-icon"><svg viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#8B6914" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
                <div className="perk-text">Hands-on onboarding before proxy season opens</div>
              </div>
              <div className="reg-perk">
                <div className="perk-icon"><svg viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#8B6914" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
                <div className="perk-text">Direct access to the founding team for feedback and product input</div>
              </div>
            </div>
          </div>
          <div>
            <div className="reg-card">
              <div id="form-state" style={{display: formVisible ? 'block' : 'none'}}>
                <div className="type-tog">
                  <button className={`t-btn ${utype==='fund' ? 'on' : ''}`} id="btn-fund" onClick={()=>setType('fund')}>Fund Manager</button>
                  <button className={`t-btn ${utype==='advisor' ? 'on' : ''}`} id="btn-adv" onClick={()=>setType('advisor')}>Financial Advisor</button>
                </div>
                <div className="frow">
                  <div className="fg"><label className="fl">First name</label><input className="fi" type="text" placeholder="Jane" id="fname" ref={fnameRef} /></div>
                  <div className="fg"><label className="fl">Last name</label><input className="fi" type="text" placeholder="Smith" id="lname" /></div>
                </div>
                <div className="fg"><label className="fl">Work email</label><input className="fi" type="email" placeholder="jane@firmname.com" id="email" ref={emailRef} /></div>
                <div className="fg"><label className="fl">Firm name</label><input className="fi" type="text" placeholder="Smith Capital Partners" id="firm" /></div>
                <div className="fg"><label className="fl" id="aum-lbl">{utype==='fund' ? 'AUM range' : 'Client AUM range'}</label>
                  <select className="fs" id="aum">
                    <option value="">Select range...</option>
                    <option>Under $50M</option>
                    <option>$50M – $250M</option>
                    <option>$250M – $1B</option>
                    <option>$1B – $10B</option>
                    <option>Over $10B</option>
                  </select>
                </div>
                <div className={`adv-box ${utype==='advisor' ? 'show' : ''}`} id="adv-box">
                  <label className="adv-tog"><input type="checkbox" id="del-check" checked={delChecked} onChange={toggleDel}/> I want to send questionnaires to clients rather than fill them out myself</label>
                  <div id="cnt-grp" style={{display: delChecked ? 'block' : 'none', marginTop:'.875rem'}}><label className="fl">Approx. number of clients</label><input className="fi" type="number" placeholder="e.g. 40" id="client-n" min="1"/></div>
                </div>
                <div className="fg"><label className="fl">How did you hear about us?</label>
                  <select className="fs" id="source">
                    <option value="">Select...</option>
                    <option>LinkedIn</option>
                    <option>Twitter / X</option>
                    <option>Word of mouth</option>
                    <option>Press / media</option>
                    <option>Conference</option>
                    <option>Other</option>
                  </select>
                </div>
                <button className="sub-btn" onClick={submitForm}>Request early access</button>
                <div className="form-note">By signing up you agree to our <a href="#">Terms</a> and <a href="#">Privacy Policy</a>. No spam.</div>
              </div>
              <div className="suc-wrap" id="suc-wrap" style={{display: formVisible ? 'none' : 'block'}}>
                <div className="suc-icon"><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 10l4.5 4.5L16 6" stroke="#8B6914" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
                <div className="suc-title">You're on the list</div>
                <div className="suc-sub">We'll be in touch before proxy season.<br/>Watch for a message at <strong id="suc-email" style={{color:'var(--ink)'}}>{sucEmail}</strong></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer>
        <div className="foot-logo">Consul<span>.AI</span></div>
        <div className="foot-copy">© 2025 Consul.AI. All rights reserved.</div>
        <div className="foot-links">
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
          <a href="#">Security</a>
          <a href="#">Contact</a>
        </div>
      </footer>
    </>
  )
}
