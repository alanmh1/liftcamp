// The deletion confirmation email. Same layout, colors and logo as the
// auth emails (Supabase Auth templates, sent through Resend): a white card
// on paper, the logo and wordmark, a heading, body copy, a muted note, and
// the site line under the card. Transactional, so there is no button and
// no unsubscribe link; the footer links to the privacy page.

const FONT = "Outfit,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

export const DELETED_SUBJECT = "Your LiftCamp account has been deleted";

const HEADING = "Your account has been deleted";
const BODY =
  "Your LiftCamp account has been deleted, along with your profile, workouts, sets, routines, shared routine links, PR goals and usage history. This cannot be undone.";
const NOTE = "If you didn't delete it, reply to this email and tell us.";
const PRIVACY_URL = "https://liftcamp.app/privacy";

export const DELETED_HTML = `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${DELETED_SUBJECT}.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FDFCFB;margin:0;padding:32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background-color:#FFFFFF;border:1px solid #DCD6CD;border-radius:20px;">
        <tr>
          <td style="padding:32px;font-family:${FONT};">

            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
              <tr>
                <td valign="middle" style="padding-right:10px;">
                  <img src="https://liftcamp.app/email/logo@2x.png" alt="LiftCamp" width="40" height="40" style="display:block;width:40px;height:40px;border:0;">
                </td>
                <td valign="middle" style="font-family:${FONT};font-size:18px;font-weight:700;letter-spacing:-0.2px;color:#221F1B;">LiftCamp</td>
              </tr>
            </table>

            <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;letter-spacing:-0.48px;color:#221F1B;">${HEADING}</h1>

            <p style="margin:0;font-size:15px;line-height:22px;color:#6B655D;">${BODY}</p>

            <p style="margin:24px 0 0;font-size:13px;line-height:20px;color:#9A948B;">${NOTE}</p>

          </td>
        </tr>
      </table>

      <p style="margin:20px 0 0;font-family:${FONT};font-size:12px;color:#9A948B;">liftcamp.app &middot; <a href="${PRIVACY_URL}" style="color:#9A948B;text-decoration:underline;">Privacy policy</a></p>
    </td>
  </tr>
</table>
`;

export const DELETED_TEXT = `${HEADING}

${BODY}

${NOTE}

liftcamp.app
Privacy policy: ${PRIVACY_URL}
`;
