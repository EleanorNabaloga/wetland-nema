// Officer guide: how to sign in and use the NEMA dashboard.
// Public on purpose (no data on it), linked from the login page and dashboard.
// The "example screens" are drawings, not working forms.

export const metadata = { title: "How to use the NEMA dashboard · Kuuma Obutonde" };

const wrap = { maxWidth: 760, margin: "0 auto", padding: "24px 16px 64px" };
const card = {
  background: "var(--card)",
  border: "1px solid var(--line)",
  borderRadius: 16,
  padding: "16px 18px",
  margin: "14px 0",
};
const stepNo = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 30,
  height: 30,
  borderRadius: 999,
  background: "var(--green)",
  color: "#fff",
  fontWeight: 800,
  marginRight: 10,
  flex: "none",
};
const screen = {
  border: "2px dashed var(--line)",
  borderRadius: 14,
  padding: 14,
  margin: "12px 0 4px",
  background: "var(--bg)",
  maxWidth: 360,
};
const fakeInput = {
  border: "1.5px solid var(--line)",
  borderRadius: 10,
  padding: "8px 10px",
  margin: "6px 0",
  background: "var(--card)",
  color: "var(--muted)",
  fontSize: 15,
};
const fakeButton = {
  borderRadius: 10,
  padding: "9px 10px",
  margin: "8px 0 2px",
  background: "var(--green)",
  color: "#fff",
  fontWeight: 700,
  textAlign: "center",
  fontSize: 15,
};
const caption = { fontSize: 13, color: "var(--muted)", margin: "0 0 4px" };
const table = { width: "100%", borderCollapse: "collapse", fontSize: 15 };
const td = { borderTop: "1px solid var(--line)", padding: "8px 6px", verticalAlign: "top" };

function Step({ n, title, children }) {
  return (
    <section style={card}>
      <h2 style={{ display: "flex", alignItems: "center", margin: "0 0 8px" }}>
        <span style={stepNo}>{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Example({ label, children }) {
  return (
    <div>
      <div style={screen} aria-hidden="true">
        {children}
      </div>
      <p style={caption}>Example screen: {label}</p>
    </div>
  );
}

export default function HelpPage() {
  return (
    <main style={wrap}>
      <p>
        <a className="link" href="/login">← Back to sign in</a>
      </p>
      <h1>How to use the NEMA dashboard</h1>
      <p className="muted">
        A short guide for NEMA officers: getting access, signing in with two-step login,
        and handling the pollution reports sent by the public through Kuuma Obutonde.
      </p>

      <section style={card}>
        <h2 style={{ marginTop: 0 }}>Before you start, you need</h2>
        <ul>
          <li>Your official NEMA email address.</li>
          <li>
            A phone with an authenticator app, such as <b>Google Authenticator</b> or{" "}
            <b>Microsoft Authenticator</b> (free from the Play Store or App Store).
          </li>
          <li>A password of at least 12 characters that you don't use anywhere else.</li>
        </ul>
      </section>

      <Step n={1} title="Ask for access (first time only)">
        <ol>
          <li>On the sign-in page, choose <b>Request access</b>.</li>
          <li>Enter your full name, your official NEMA email and a password (12+ characters), twice.</li>
          <li>You will see <b>Request received</b>. An administrator checks it and gives you a role.</li>
          <li>You can sign in once you are approved. Until then, signing in says your account is not active.</li>
        </ol>
        <Example label="Request access">
          <b>Request access</b>
          <div style={fakeInput}>Full name</div>
          <div style={fakeInput}>Official NEMA email</div>
          <div style={fakeInput}>Password (12+ characters)</div>
          <div style={fakeInput}>Confirm password</div>
          <div style={fakeButton}>Request access</div>
        </Example>
      </Step>

      <Step n={2} title="Sign in with your email and password">
        <ol>
          <li>Open the dashboard and go to <b>NEMA Officer Login</b>.</li>
          <li>Enter your work email and password, then choose <b>Sign in</b>.</li>
          <li>After 5 wrong tries, wait 15 minutes before trying again.</li>
        </ol>
        <Example label="NEMA Officer Login">
          <b>NEMA Officer Login</b>
          <div style={fakeInput}>Work email</div>
          <div style={fakeInput}>Password</div>
          <div style={fakeButton}>Sign in</div>
        </Example>
      </Step>

      <Step n={3} title="Set up two-step login (first sign-in only)">
        <ol>
          <li>After your password, the dashboard shows a <b>QR code</b>.</li>
          <li>
            Open your authenticator app, tap <b>+</b> (add account), choose <b>Scan a QR code</b> and
            point the camera at the screen. If you can't scan, type the key shown under the code.
          </li>
          <li>The app now shows <b>NEMA Kuuma Obutonde</b> with a 6-digit code that changes every 30 seconds.</li>
          <li>Type the current code and choose <b>Confirm and sign in</b>.</li>
        </ol>
        <Example label="two-step setup">
          <div
            style={{
              width: 110,
              height: 110,
              margin: "4px 0 8px",
              background:
                "repeating-conic-gradient(var(--ink) 0 25%, var(--card) 0 50%) 0 0 / 22px 22px",
              borderRadius: 6,
            }}
          />
          <div style={caption}>Can't scan? Enter this key by hand: ABCD EFGH …</div>
          <div style={fakeInput}>123456</div>
          <div style={fakeButton}>Confirm and sign in</div>
        </Example>
      </Step>

      <Step n={4} title="Every sign-in after that">
        <ol>
          <li>Enter your email and password.</li>
          <li>Open your authenticator app, type the 6-digit code for <b>NEMA Kuuma Obutonde</b> and choose <b>Verify</b>.</li>
          <li>Each code works once. If it says the code was already used, wait for the next one.</li>
          <li>You stay signed in for 8 hours. Use <b>Sign out</b> (top right) on shared computers.</li>
        </ol>
      </Step>

      <Step n={5} title="Find your way around the reports">
        <p>The top of the dashboard counts <b>New</b>, <b>Overdue</b> and <b>All reports</b>. Use the tabs below it to filter the list:</p>
        <ul>
          <li><b>All</b>: every report, newest first.</li>
          <li><b>New</b>: not yet looked at by an officer.</li>
          <li><b>Overdue</b>: past the deadline for their current stage. Start here.</li>
        </ul>
        <p>Each row shows the photo, report number, type, location, time and these badges:</p>
        <table style={table}>
          <tbody>
            <tr>
              <td style={td}><span className="badge b-new">New</span> / <span className="badge b-ok">Reviewed</span></td>
              <td style={td}>Whether an officer has reviewed it yet.</td>
            </tr>
            <tr>
              <td style={td}><span className="badge b-ok">due in 2 d</span> / <span className="badge">overdue 1 d</span></td>
              <td style={td}>Time left for the current stage, or how late it is.</td>
            </tr>
            <tr>
              <td style={td}><span className="badge b-bad">Gallery upload</span></td>
              <td style={td}>
                The photo was chosen from the phone's gallery, not taken live in the app. Check the photo,
                time and place carefully.
              </td>
            </tr>
            <tr>
              <td style={td}><span className="badge b-new">Taken 3 d before sending</span></td>
              <td style={td}>The photo is more than 48 hours older than the report.</td>
            </tr>
            <tr>
              <td style={td}><span className="badge b-ok">Verified on arrival</span></td>
              <td style={td}>The evidence signature was checked: the photo, place and time were not changed after capture.</td>
            </tr>
          </tbody>
        </table>
      </Step>

      <Step n={6} title="Handle a report, step by step">
        <ol>
          <li>
            <b>Open it.</b> Look at the photo, the note, the map link, GPS accuracy, how it was submitted,
            the evidence signature and the reporter's trust.
          </li>
          <li>
            <b>Mark as reviewed.</b> This tells the reporter a person has looked at it, and unlocks their reward.
          </li>
          <li>
            <b>Choose a Triage category:</b>
            <ul>
              <li><b>Emergency</b>: serious harm now (e.g. chemical or sewage spill). Needs an inspection.</li>
              <li><b>Enforcement</b>: a breach NEMA should act on. Needs an inspection.</li>
              <li><b>Referral</b>: belongs to another agency.</li>
              <li><b>Duplicate</b>: the same incident was already reported.</li>
              <li><b>Insufficient</b>: not enough information to act.</li>
            </ul>
          </li>
          <li>
            <b>Inspect</b> (Emergency and Enforcement only). After the site visit, choose{" "}
            <b>Mark inspection done</b>.
          </li>
          <li>
            <b>Set the Next step.</b> The reporter sees this on their phone in their language:{" "}
            <i>Inspector will visit</i>, <i>Referred to another agency</i> or <i>Need more information</i>.
          </li>
          <li>
            <b>Fake or abusive report?</b> Choose <b>Mark as false report</b>. This lowers that device's
            trust score, so its future reports count for less.
          </li>
        </ol>
        <p className="muted">
          Every action is saved with your name and the time in the audit log.
        </p>
      </Step>

      <Step n={7} title="Deadlines for each stage">
        <table style={table}>
          <tbody>
            <tr><td style={td}><b>Acknowledge</b> (mark as reviewed)</td><td style={td}>2 days</td></tr>
            <tr><td style={td}><b>Triage</b> (choose a category)</td><td style={td}>7 days</td></tr>
            <tr><td style={td}><b>Inspect</b></td><td style={td}>3 days for Emergency, 30 days for Enforcement</td></tr>
            <tr><td style={td}><b>Decide</b> (set the next step)</td><td style={td}>45 days</td></tr>
          </tbody>
        </table>
        <p className="muted">All counted from when the report arrived.</p>
      </Step>

      <Step n={8} title="See where problems cluster: Hotspots">
        <p>
          Choose <b>Hotspots</b> at the top of the dashboard. Reviewed reports are grouped into areas of about
          500 metres and ranked:
        </p>
        <ul>
          <li><b style={{ color: "#ef4444" }}>Red</b>: the most serious, most reported areas. Plan visits here first.</li>
          <li><b style={{ color: "#f59e0b" }}>Orange</b>: serious.</li>
          <li><b style={{ color: "#ca8a04" }}>Yellow</b>: watch. An area reported by only one device stays yellow.</li>
        </ul>
        <p>
          Each area shows whether it is <i>Getting worse</i>, <i>Steady</i> or <i>Improving</i>. Older reports count
          less over time, so the map shows current problems.
        </p>
      </Step>

      <Step n={9} title="For administrators: approve officers">
        <ol>
          <li>Go to <b>/admin/staff</b> (Staff access).</li>
          <li>New requests are at the top. Choose a role, then <b>Approve</b>, or choose <b>Reject</b>.</li>
          <li>When someone leaves NEMA, choose <b>Disable</b>. They can no longer sign in.</li>
          <li>Roles: <b>reviewer</b> and <b>inspector</b> handle reports; <b>legal</b> can view them.</li>
        </ol>
      </Step>

      <section style={card}>
        <h2 style={{ marginTop: 0 }}>Problems signing in?</h2>
        <ul>
          <li><b>"Account not active"</b>: your request is still waiting for approval, or was disabled. Ask an administrator.</li>
          <li><b>"Invalid code"</b>: check your phone's time is set automatically, and use the newest code.</li>
          <li><b>"Too many attempts"</b>: wait 15 minutes, then try again.</li>
          <li><b>Lost or changed phone</b>: ask an administrator to reset your two-step login so you can scan a new QR code.</li>
          <li>Never share your password or codes. NEMA staff will never ask for them.</li>
        </ul>
      </section>

      <p>
        <a className="link" href="/login">Go to sign in →</a>
      </p>
    </main>
  );
}
