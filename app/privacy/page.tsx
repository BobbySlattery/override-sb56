import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — SaveOhioBevs",
  description: "Privacy policy for the SaveOhioBevs civic engagement platform.",
};

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Header */}
      <header className="bg-gray-900 text-white py-6">
        <div className="max-w-3xl mx-auto px-6">
          <a href="/" className="text-orange-400 font-bold text-lg hover:underline">
            &larr; Back to SaveOhioBevs
          </a>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-gray-500 mb-8">Last updated: March 28, 2026</p>

        <section className="mb-8">
          <h2 className="text-xl font-bold mb-3">Overview</h2>
          <p className="text-gray-700 leading-relaxed">
            SaveOhioBevs.com is a civic engagement tool created to help Ohio residents
            contact their state legislators regarding the override of Governor DeWine's
            line-item veto of SB 56's THC beverage provisions. We respect your privacy
            and are committed to protecting the personal information you share with us.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold mb-3">Information We Collect</h2>
          <p className="text-gray-700 leading-relaxed mb-3">
            When you use our tool to contact your legislators, we collect the following
            information that you voluntarily provide:
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2">
            <li>Your full name</li>
            <li>Your email address</li>
            <li>Your home address, city, and zip code</li>
          </ul>
          <p className="text-gray-700 leading-relaxed mt-3">
            We also use your location (via browser geolocation or the address you
            provide) solely to identify your Ohio state legislative districts and
            connect you with your representatives.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold mb-3">How We Use Your Information</h2>
          <p className="text-gray-700 leading-relaxed">
            Your information is used exclusively to:
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2 mt-3">
            <li>Identify your Ohio State House Representative and State Senator</li>
            <li>
              Send emails on your behalf to your legislators, Speaker of the House
              Matt Huffman, and Senate President Rob McColley urging them to bring
              the override vote to the floor
            </li>
            <li>Send you a confirmation email with additional ways to take action</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold mb-3">Information We Do Not Collect</h2>
          <ul className="list-disc pl-6 text-gray-700 space-y-2">
            <li>We do not use cookies or tracking pixels</li>
            <li>We do not collect payment or financial information</li>
            <li>We do not track your browsing activity across other websites</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold mb-3">Data Sharing</h2>
          <p className="text-gray-700 leading-relaxed">
            We do not sell, rent, or share your personal information with third
            parties for marketing purposes. Your information is shared only with
            your elected officials as part of the email you authorize us to send
            on your behalf. We use Resend, a third-party email service, to deliver
            these messages.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold mb-3">Data Retention</h2>
          <p className="text-gray-700 leading-relaxed">
            We securely store your name, email, and address in an encrypted
            database to ensure reliable delivery of your messages to legislators.
            If our email service experiences an outage, your information is
            preserved so your emails can still be sent. If you opted in to future
            updates, we may also use your contact information to notify you about
            important developments related to SB 56 and the override effort. We
            will not use your information for any unrelated purpose. You may
            request deletion of your data at any time by contacting us.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold mb-3">Business Supporters</h2>
          <p className="text-gray-700 leading-relaxed">
            If you sign up as a business supporter, we collect your business name,
            location, contact name, email, phone number, and business type. This
            information is used solely to coordinate the SaveOhioBevs campaign
            and will not be shared with third parties without your consent.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold mb-3">Your Rights</h2>
          <p className="text-gray-700 leading-relaxed">
            You may contact us at any time to request a copy of the data we hold
            about you, or to request its deletion. We will fulfill deletion
            requests within 30 days. To make a request, email us at{" "}
            <a
              href="mailto:bobby@50westbrew.com"
              className="text-orange-600 hover:underline"
            >
              bobby@50westbrew.com
            </a>
            .
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold mb-3">Contact Us</h2>
          <p className="text-gray-700 leading-relaxed">
            If you have questions about this privacy policy or how your information
            is handled, please contact us at{" "}
            <a
              href="mailto:bobby@50westbrew.com"
              className="text-orange-600 hover:underline"
            >
              bobby@50westbrew.com
            </a>
            .
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400">
        <div className="max-w-3xl mx-auto px-6 py-8 text-center text-sm">
          <p>&copy; 2026 SaveOhioBevs. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
