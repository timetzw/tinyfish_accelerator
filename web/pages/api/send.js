import nodemailer from 'nodemailer'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const {
    fname,
    lname,
    email,
    firm,
    aum,
    utype,
    delChecked,
    clientN,
    source
  } = req.body || {}

  // Basic validation
  if (!fname || !email) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  // Read SMTP config from environment
  const SMTP_HOST = process.env.SMTP_HOST
  const SMTP_PORT = process.env.SMTP_PORT
  const SMTP_USER = process.env.SMTP_USER
  const SMTP_PASS = process.env.SMTP_PASS
  const EMAIL_FROM = process.env.EMAIL_FROM || SMTP_USER
  const RECIPIENTS = process.env.RECIPIENTS || 'yusiwang30@gmail.com,dnlchong@gmail.com,timetzw@gmail.com'

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    return res.status(500).json({ error: 'Mail server not configured. Set SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS.' })
  }

  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: Number(SMTP_PORT) === 465, // true for 465, false for other ports
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    })

    const subject = `Tinyfish early access request — ${fname} ${lname}`
    const plain = `Name: ${fname} ${lname}\nEmail: ${email}\nFirm: ${firm || ''}\nRole: ${utype || ''}\nAUM: ${aum || ''}\nSend to clients?: ${delChecked ? 'yes' : 'no'}\nApprox clients: ${clientN || ''}\nSource: ${source || ''}`
    const html = `<p><strong>Name:</strong> ${fname} ${lname}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Firm:</strong> ${firm || ''}</p>
      <p><strong>Role:</strong> ${utype || ''}</p>
      <p><strong>AUM:</strong> ${aum || ''}</p>
      <p><strong>Send questionnaires to clients?:</strong> ${delChecked ? 'yes' : 'no'}</p>
      <p><strong>Approx clients:</strong> ${clientN || ''}</p>
      <p><strong>How did they hear about us:</strong> ${source || ''}</p>`

    await transporter.sendMail({
      from: EMAIL_FROM,
      to: RECIPIENTS,
      subject,
      text: plain,
      html,
    })

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('send error', err)
    return res.status(500).json({ error: 'Failed to send email' })
  }
}
