import Link from "next/link";
import { LegalPage, List, Section, Sub, Term } from "@/components/LegalPage";

export const metadata = {
  title: "Terms of Service",
  description:
    "The terms on which Christian Foundation is offered — accounts, conduct, creators, bookings and contracts, payments, and giving.",
};

const SUPPORT = "support@thecf.online";

export default function TermsOfServicePage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of Service"
      updated="8 September 2026"
      intro={
        <p>
          These are the terms on which Christian Foundation (&ldquo;CF&rdquo;)
          is offered. They are written to be read, not to be got past. Using CF
          means agreeing to them.
        </p>
      }
    >
      <Section n={1} heading="Accepting these terms">
        <p>
          By using CF at thecf.online you accept these terms and our{" "}
          <Link
            href="/privacy"
            className="text-amber-700 underline dark:text-amber-400"
          >
            Privacy Policy
          </Link>
          . If you don&apos;t accept them, please don&apos;t use the service.
        </p>
      </Section>

      <Section n={2} heading="What CF is">
        <p>
          CF is a library of Christian teaching — video gathered from YouTube
          and shown here in order, written pathways, and ebooks — together with
          channels for the teachers who make it. Creators may also offer
          business tools: bookings, one-to-one sessions, quotes, invoices, and
          contracts signed on the platform, and campaigns that receive support
          from others.
        </p>
        <p>
          We may change, suspend, or discontinue any part of CF. Where a change
          matters to you, we will give reasonable notice.
        </p>
      </Section>

      <Section n={3} heading="Your account">
        <p>To hold an account on CF you must:</p>
        <List>
          <li>Be at least 16 years old, and at least 18 to be paid through CF;</li>
          <li>Give accurate registration details and keep them current;</li>
          <li>Keep your sign-in credentials to yourself;</li>
          <li>Take responsibility for what happens under your account.</li>
        </List>
        <p>
          Sending a booking request or signing a document does not require an
          account. When you do either as a guest, these terms still apply to
          that act.
        </p>
      </Section>

      <Section n={4} heading="Conduct">
        <p>You agree not to:</p>
        <List>
          <li>Use CF for anything unlawful, or break the law where you are;</li>
          <li>
            Infringe anyone&apos;s copyright, trademark, privacy, or other
            rights;
          </li>
          <li>
            Post material that is abusive, harassing, deceptive, or targets a
            person or group with hatred;
          </li>
          <li>
            Misrepresent who you are, or claim a channel, ministry, or
            credential that is not yours;
          </li>
          <li>
            Disrupt the service, evade its limits, or try to reach any part of
            it you have not been given;
          </li>
          <li>
            Scrape, resell, or bulk-extract CF&apos;s content or other
            people&apos;s information.
          </li>
        </List>
      </Section>

      <Section n={5} heading="Publishing on CF">
        <p>
          Publishing here is not open by default. Applying involves affirming
          CF&apos;s published doctrinal statement, and may involve vouches from
          existing creators. Approval is at our discretion, and a channel may be
          reviewed, suspended, or removed if its teaching turns out to depart
          from what was affirmed, or if these terms are broken.
        </p>
        <p>
          Creators keep ownership of what they make. By publishing on CF you
          grant us a non-exclusive licence to host, display, embed, and promote
          that material on CF and in describing CF elsewhere. You confirm you
          have the rights to everything you publish, including any YouTube
          channel you claim — which we verify before importing.
        </p>
        <p>
          <Term>In essentials, unity. In non-essentials, liberty. In all
          things, charity.</Term> Disagreement over secondary matters is not, by
          itself, cause for removal.
        </p>
      </Section>

      <Section n={6} heading="Bookings, sessions, and contracts">
        <Sub>6.1 CF is not a party to the engagement</Sub>
        <p>
          When you book a creator, or a creator accepts your request, the
          agreement is between the two of you. CF provides the tools — the
          calendar, the request, the quote, the contract, the invoice — and
          nothing more. We do not vet, guarantee, supervise, or insure any
          engagement, and we are not responsible for whether it happens, how it
          goes, or whether either side is paid what they expected.
        </p>

        <Sub>6.2 Electronic signatures</Sub>
        <p>
          Documents signed on CF are signed electronically, and both sides
          intend them to be binding. With each signature we record the
          signer&apos;s name and email, the time, the IP address, and the
          browser used, and we freeze a copy of the document as it stood at
          signing, with a hash so that later alteration would show. That record
          is evidence of the agreement and is kept accordingly. Whether a
          particular document is legally enforceable is a matter of the law that
          governs it, not of CF.
        </p>

        <Sub>6.3 Slots and holds</Sub>
        <p>
          Requesting a time slot holds it for a limited period so two people
          cannot claim it at once. A hold is not a confirmed booking: the
          creator still has to accept. Unaccepted holds are released
          automatically.
        </p>

        <Sub>6.4 Cancellation</Sub>
        <p>
          Cancellation and refund terms for an engagement are whatever the
          creator and the client agreed, ordinarily in the contract signed here.
          CF does not set them and does not arbitrate them.
        </p>
      </Section>

      <Section n={7} heading="Payments, giving, and fees">
        <Sub>7.1 How money moves</Sub>
        <p>
          Payments are processed by Stripe, and micro-payments by Trickl. CF
          does not hold, escrow, or take custody of anyone&apos;s money. Funds
          go to the creator&apos;s connected payment account, less the platform
          fee and the processor&apos;s own fees. How quickly they land is a
          matter for the processor and the creator&apos;s bank, not for us.
        </p>

        <Sub>7.2 Giving is giving</Sub>
        <p>
          Support given to a creator or a campaign is a gift to that creator,
          not a purchase, an investment, a deposit, or a pre-order, and CF is
          not a bank or a money transmitter. Anything a creator promises in
          return — access, materials, thanks, an outcome — is promised by them,
          not by CF. We do not verify or guarantee it.
        </p>

        <Sub>7.3 Refunds</Sub>
        <p>
          Because funds pass to the creator, CF does not refund from platform
          money. Ask the creator; they may refund from their own balance through
          their processor. You keep whatever rights you have to dispute a card
          charge with your card issuer, and those disputes are settled by the
          card networks under their own rules. Repeated or unfounded chargebacks
          may cost you your account.
        </p>

        <Sub>7.4 Fees and tax</Sub>
        <p>
          CF charges a platform fee, shown before you confirm, which we may
          change with notice. Creators are responsible for their own taxes on
          what they receive, and for the accuracy of what they invoice.
        </p>
      </Section>

      <Section n={8} heading="Copyright and takedowns">
        <p>
          CF respects copyright and expects the same of everyone here. The
          library embeds YouTube video rather than hosting it, so it plays from
          YouTube under its terms and its rights holders&apos; settings.
        </p>
        <p>
          If you believe material on CF infringes your copyright, write to{" "}
          <a
            href={`mailto:${SUPPORT}`}
            className="text-amber-700 underline dark:text-amber-400"
          >
            {SUPPORT}
          </a>{" "}
          identifying the work, where the material is on CF, your contact
          details, and a statement that you hold the rights or act for whoever
          does. Where a notice is valid we will remove or disable the material,
          tell the creator, let them answer, and remove channels that infringe
          repeatedly.
        </p>
      </Section>

      <Section n={9} heading="Third-party services">
        <p>
          CF works alongside YouTube, Google, Clerk, Stripe, Trickl, and Amazon
          Web Services. Using those parts of CF also means accepting their
          terms. Our use of Google APIs is described in section 5 of the{" "}
          <Link
            href="/privacy"
            className="text-amber-700 underline dark:text-amber-400"
          >
            Privacy Policy
          </Link>
          , and follows the Google API Services User Data Policy, including its
          Limited Use requirements.
        </p>
      </Section>

      <Section n={10} heading="CF's own material">
        <p>
          The CF name, design, written pathways, doctrinal map, and software are
          ours or our licensors&apos;, and are protected by copyright and
          trademark law. These terms give you no licence to them beyond using CF
          as it is meant to be used.
        </p>
      </Section>

      <Section n={11} heading="Provided as is">
        <p>
          CF is provided as is and as available, without warranties of any kind
          beyond those the law will not let us exclude. We do not warrant that
          the service will be uninterrupted or error-free, that the teaching
          published here will suit your situation, or that any creator will
          perform as you hoped.
        </p>
      </Section>

      <Section n={12} heading="Limitation of liability">
        <p>
          To the extent the law allows, CF is not liable for indirect,
          incidental, special, consequential, or punitive damages, nor for lost
          profits, revenue, data, or goodwill, arising from your use of or
          inability to use the service. Our total liability for any claim is
          limited to the greater of the fees you paid CF in the twelve months
          before the claim, or one hundred United States dollars. Nothing here
          excludes liability that cannot lawfully be excluded.
        </p>
      </Section>

      <Section n={13} heading="Ending your use">
        <p>
          You may close your account at any time. We may suspend or end access
          where these terms are broken, where the law requires it, or where
          continuing would put others at risk — with notice when circumstances
          allow, and immediately when they do not. Obligations already incurred,
          contracts already signed, and payments already made survive the
          ending.
        </p>
      </Section>

      <Section n={14} heading="Changes to these terms">
        <p>
          We may revise these terms. Where a revision is material we will give
          at least 30 days&apos; notice before it takes effect. Continuing to
          use CF after that is acceptance; if you would rather not, close your
          account.
        </p>
      </Section>

      <Section n={15} heading="Contact us">
        <p>
          Questions about these terms, or a copyright notice:{" "}
          <a
            href={`mailto:${SUPPORT}`}
            className="text-amber-700 underline dark:text-amber-400"
          >
            {SUPPORT}
          </a>
          .
        </p>
      </Section>
    </LegalPage>
  );
}
