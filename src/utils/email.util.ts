import Mailjet from "node-mailjet";
import dotenv from "dotenv";

dotenv.config();

/* -------------------------------------------
   MAILJET INITIALIZATION
-------------------------------------------- */

// Require environment variables for security and correctness
const API_KEY = process.env.MAILJET_API_KEY;
const API_SECRET = process.env.MAILJET_API_SECRET;
const MAIL_FROM_ADDRESS = process.env.MAIL_FROM_ADDRESS;
const MAIL_FROM_NAME = process.env.MAIL_FROM_NAME || "FLEXEE DA";

// Validate configuration on startup
if (!API_KEY || !API_SECRET) {
  console.warn(
    "⚠️  WARNING: Mailjet API credentials not configured. Set MAILJET_API_KEY and MAILJET_API_SECRET environment variables."
  );
}

if (!MAIL_FROM_ADDRESS) {
  console.warn(
    "⚠️  WARNING: Sender email not configured. Set MAIL_FROM_ADDRESS environment variable to a verified Mailjet sender email."
  );
}

const mailjet = Mailjet.apiConnect(API_KEY || "", API_SECRET || "");

/* -------------------------------------------
   EMAIL UI WRAPPER (REUSABLE LAYOUT)
   Analytics Edition palette — violet primary,
   emerald accent, amber for data signals.
-------------------------------------------- */

const BRAND = {
  bgPage:       "#F5F3FF",   // pale violet tint
  bgSurface:    "#FFFFFF",
  bgElevated:   "#FAF7FF",
  border:       "#E9E4F5",
  textPrimary:  "#1E1B2E",
  textMuted:    "#6B6881",
  accent:       "#7C3AED",   // violet-600
  accentHover:  "#6D28D9",   // violet-700
  accentLight:  "#F3EEFF",
  accent2:      "#059669",   // emerald-600
  accent3:      "#D97706",   // amber-600
};

function emailWrapper(content: string) {
  return `
  <div style="background:${BRAND.bgPage};padding:40px 16px;
              font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
              color:${BRAND.textPrimary};">
    <div style="max-width:600px;margin:0 auto;background:${BRAND.bgSurface};
                border:1px solid ${BRAND.border};border-radius:14px;padding:36px 32px;
                box-shadow:0 1px 3px rgba(76,29,149,0.08);">
      ${content}
    </div>

    <div style="max-width:600px;margin:24px auto 0;text-align:center;">
      <p style="color:${BRAND.textMuted};font-size:12px;margin:0 0 4px;
                font-family:'Inter',Arial,sans-serif;">
        (c) 2026 FLEXEE DA - One Smarter Inc.
      </p>
      <p style="color:${BRAND.textMuted};font-size:12px;margin:0;
                font-family:'Inter',Arial,sans-serif;">
        <a href="https://flexee.onesmarter.com"
           style="color:${BRAND.accent};text-decoration:none;font-weight:500;">
          flexee.onesmarter.com
        </a>
      </p>
    </div>
  </div>
  `;
}

/* -------------------------------------------
   SEND EMAIL VIA MAILJET
-------------------------------------------- */

async function sendEmailViaMailjet(
  toEmail: string,
  toName: string,
  subject: string,
  htmlContent: string
): Promise<boolean> {
  // Validate configuration
  if (!MAIL_FROM_ADDRESS) {
    console.error(
      "✗ Cannot send email: MAIL_FROM_ADDRESS environment variable not set. Configure a verified Mailjet sender email."
    );
    return false;
  }

  if (!API_KEY || !API_SECRET) {
    console.error(
      "✗ Cannot send email: Mailjet API credentials not configured. Set MAILJET_API_KEY and MAILJET_API_SECRET."
    );
    return false;
  }

  try {
    const request = mailjet.post("send", { version: "v3.1" }).request({
      Messages: [
        {
          From: {
            Email: MAIL_FROM_ADDRESS,
            Name: MAIL_FROM_NAME,
          },
          To: [
            {
              Email: toEmail,
              Name: toName,
            },
          ],
          Subject: subject,
          HTMLPart: htmlContent,
          TrackOpens: "enabled",
          TrackClicks: "enabled",
        },
      ],
    });

    const response = await request;
    const responseBody = response?.body as any;
    
    console.log("Mailjet Response - Body Type:", typeof responseBody);
    console.log("Mailjet Response - Has Messages:", !!responseBody?.Messages);
    
    if (responseBody?.Messages && responseBody.Messages[0]) {
      const message = responseBody.Messages[0];
      console.log("Message Status:", message.Status);

      if (message.Status === "success") {
        const recipient = message.To?.[0];
        const messageId = recipient?.MessageID;
        const messageUuid = recipient?.MessageUUID;
        const messageHref = recipient?.MessageHref;

        console.log(`✓ Email accepted by Mailjet for ${toEmail}`);
        console.log(`  From: ${MAIL_FROM_ADDRESS}`);
        console.log(`  MessageID:   ${messageId}`);
        console.log(`  MessageUUID: ${messageUuid}`);
        console.log(`  Lookup URL:  ${messageHref}`);
        return true;
      } else {
        console.error(`✗ Email delivery failed with status: ${message.Status}`);
        console.error("  From:", MAIL_FROM_ADDRESS);
        console.error("  To:", toEmail);
        console.error("  Errors:", message.Errors);
        return false;
      }
    }
    
    console.error("✗ Failed to send email via Mailjet - No Messages in response");
    console.error("  From:", MAIL_FROM_ADDRESS);
    console.error("  To:", toEmail);
    console.error("  Response body:", responseBody);
    return false;
  } catch (error: any) {
    console.error("✗ Error sending email via Mailjet:", error?.message || error);
    console.error("  From:", MAIL_FROM_ADDRESS);
    console.error("  To:", toEmail);
    if (error?.response?.body) {
      console.error("  Error details:", error.response.body);
      console.error("  ** This usually means one of:");
      console.error("     1) Sender email is not verified in Mailjet");
      console.error("     2) API credentials are invalid or expired");
      console.error("     3) SPF/DKIM records are not configured");
    }
    return false;
  }
}

/* -------------------------------------------
   STUDENT SIMULATION INVITE EMAIL
-------------------------------------------- */

export async function sendStudentInviteEmail(
  email: string,
  simulationName: string,
  inviteLink: string,
  customMessage?: string
): Promise<boolean> {
  const content = `
    <!-- Edition tag (mirrors the landing page pill) -->
    <div style="text-align:center;margin-bottom:24px;">
      <span style="display:inline-block;padding:6px 14px;
                   background:${BRAND.accentLight};
                   border:1px solid ${BRAND.border};
                   border-radius:999px;
                   font-size:11px;font-weight:700;
                   color:${BRAND.accent};
                   letter-spacing:0.08em;
                   font-family:'Inter',Arial,sans-serif;">
        <span style="display:inline-block;width:6px;height:6px;border-radius:50%;
                     background:${BRAND.accent};margin-right:6px;
                     vertical-align:middle;"></span>
        ANALYTICS EDITION
      </span>
    </div>

    <!-- Headline -->
    <h1 style="font-size:26px;font-weight:800;line-height:1.2;
               margin:0 0 14px;letter-spacing:-0.02em;
               color:${BRAND.textPrimary};text-align:center;
               font-family:'Inter',Arial,sans-serif;">
      You're invited to
      <span style="color:${BRAND.accent};">${simulationName}</span>
    </h1>

    <p style="font-size:15px;line-height:1.65;color:${BRAND.textMuted};
              margin:0 0 28px;text-align:center;
              font-family:'Inter',Arial,sans-serif;">
      Your instructor has added you to a FLEXEE DA simulation.
      Accept below to join the cohort - firm assignment comes after.
    </p>

    ${customMessage ? `
      <div style="background:${BRAND.bgElevated};
                  border-left:3px solid ${BRAND.accent};
                  border-radius:6px;
                  padding:16px 18px;
                  margin:0 0 28px;">
        <div style="font-size:10px;font-weight:700;
                    color:${BRAND.accent};letter-spacing:0.08em;
                    margin-bottom:6px;
                    font-family:'Inter',Arial,sans-serif;">
          A NOTE FROM YOUR INSTRUCTOR
        </div>
        <p style="margin:0;font-size:14px;line-height:1.6;
                  color:${BRAND.textPrimary};
                  font-family:'Inter',Arial,sans-serif;">
          ${customMessage}
        </p>
      </div>
    ` : ''}

    <!-- Primary CTA -->
    <div style="text-align:center;margin:32px 0 24px;">
      <a href="${inviteLink}"
         style="display:inline-block;
                background:${BRAND.accent};color:#FFFFFF;
                padding:14px 36px;
                border-radius:9px;
                text-decoration:none;
                font-weight:700;font-size:14px;
                letter-spacing:0.01em;
                font-family:'Inter',Arial,sans-serif;
                box-shadow:0 1px 3px rgba(76,29,149,0.25);">
        Accept invitation
      </a>
    </div>

    <!-- Plain link fallback -->
    <p style="font-size:12px;color:${BRAND.textMuted};
              text-align:center;margin:0 0 32px;
              font-family:'Inter',Arial,sans-serif;
              line-height:1.5;">
      Or paste this into your browser:<br>
      <a href="${inviteLink}"
         style="color:${BRAND.accent};word-break:break-all;
                text-decoration:none;">
        ${inviteLink}
      </a>
    </p>

    <!-- Analytics loop preview — what they'll be doing -->
    <div style="border-top:1px solid ${BRAND.border};padding-top:24px;">
      <div style="font-size:10px;font-weight:700;
                  color:${BRAND.textMuted};letter-spacing:0.08em;
                  text-align:center;margin-bottom:14px;
                  font-family:'Inter',Arial,sans-serif;">
        WHAT YOU'LL BE DOING
      </div>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <td width="33%" align="center" style="padding:8px 4px;vertical-align:top;">
            <div style="width:32px;height:32px;border-radius:50%;
                        background:${BRAND.accent3};color:#FFFFFF;
                        line-height:32px;font-weight:800;font-size:13px;
                        margin:0 auto 8px;
                        font-family:'Inter',Arial,sans-serif;">1</div>
            <div style="font-size:12px;font-weight:700;color:${BRAND.textPrimary};
                        margin-bottom:2px;font-family:'Inter',Arial,sans-serif;">
              Download data
            </div>
            <div style="font-size:11px;color:${BRAND.textMuted};line-height:1.4;
                        font-family:'Inter',Arial,sans-serif;">
              Real CSV files, six modules
            </div>
          </td>
          <td width="33%" align="center" style="padding:8px 4px;vertical-align:top;">
            <div style="width:32px;height:32px;border-radius:50%;
                        background:${BRAND.accent};color:#FFFFFF;
                        line-height:32px;font-weight:800;font-size:13px;
                        margin:0 auto 8px;
                        font-family:'Inter',Arial,sans-serif;">2</div>
            <div style="font-size:12px;font-weight:700;color:${BRAND.textPrimary};
                        margin-bottom:2px;font-family:'Inter',Arial,sans-serif;">
              Run the analysis
            </div>
            <div style="font-size:11px;color:${BRAND.textMuted};line-height:1.4;
                        font-family:'Inter',Arial,sans-serif;">
              Excel, Python, R — your call
            </div>
          </td>
          <td width="33%" align="center" style="padding:8px 4px;vertical-align:top;">
            <div style="width:32px;height:32px;border-radius:50%;
                        background:${BRAND.accent2};color:#FFFFFF;
                        line-height:32px;font-weight:800;font-size:13px;
                        margin:0 auto 8px;
                        font-family:'Inter',Arial,sans-serif;">3</div>
            <div style="font-size:12px;font-weight:700;color:${BRAND.textPrimary};
                        margin-bottom:2px;font-family:'Inter',Arial,sans-serif;">
              Watch it validate
            </div>
            <div style="font-size:11px;color:${BRAND.textMuted};line-height:1.4;
                        font-family:'Inter',Arial,sans-serif;">
              The market scores your model
            </div>
          </td>
        </tr>
      </table>
    </div>

    <!-- About box -->
    <div style="background:${BRAND.bgElevated};
                border:1px solid ${BRAND.border};
                border-radius:8px;
                padding:14px 16px;
                margin-top:24px;">
      <p style="margin:0;font-size:12px;color:${BRAND.textMuted};
                line-height:1.6;
                font-family:'Inter',Arial,sans-serif;">
        <span style="color:${BRAND.textPrimary};font-weight:700;">About FLEXEE DA.</span>
        A data analytics teaching simulation where the analysis you bring back from your own
        tools meets the consequences of a live market. Your forecasts get an MAPE.
        Your supplier picks get defect rates. Your model gets graded by the result.
      </p>
    </div>
  `;

  return sendEmailViaMailjet(
    email,
    email,
    `Invitation: Join ${simulationName} on FLEXEE DA`,
    emailWrapper(content)
  );
}
