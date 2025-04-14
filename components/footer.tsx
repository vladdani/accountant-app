import Link from 'next/link';
import { Twitter, Github, MessageSquare, Database } from 'lucide-react'; // Example icons

// Define footer sections and links
const footerNav = {
  product: [
    { name: 'Features', href: '/#features' },
    { name: 'Pricing', href: '/#pricing' }, // Assuming pricing section exists or will be added
    { name: 'FAQ', href: '/#faq' },
    // Add other product links
  ],
  company: [
    { name: 'About', href: '/about' }, // Example pages
    { name: 'Blog', href: '/blog' },
    // Add other company links
  ],
  resources: [
    { name: 'Documentation', href: '/docs' },
    { name: 'Support', href: '/support' },
    // Add other resource links
  ],
  legal: [
    { name: 'Privacy Policy', href: '/privacy' },
    { name: 'Terms & Conditions', href: '/terms' },
    // Add other legal links
  ],
};

const socialLinks = [
  { name: 'Twitter', href: '#', icon: Twitter },
  { name: 'GitHub', href: '#', icon: Github },
  { name: 'Discord', href: '#', icon: MessageSquare },
];

export function Footer() {
  return (
    <footer className="bg-neutral-dark text-neutral-content w-full" aria-labelledby="footer-heading">
      <h2 id="footer-heading" className="sr-only">
        Footer
      </h2>
      <div className="mx-auto max-w-7xl px-6 pb-8 pt-16 sm:pt-24 lg:px-8 lg:pt-32">
        <div className="xl:grid xl:grid-cols-3 xl:gap-8">
          {/* Logo and Social Links */}
          <div className="space-y-8">
             <div className="flex items-center space-x-3">
                  <Database className="h-8 w-8 text-primary" /> {/* Updated Icon */}
                  <span className="text-xl font-semibold text-white">Digital Storage</span> {/* Updated App Name */}
             </div>
            <p className="text-sm leading-6 text-gray-300">
              Smart document management for Indonesian accountants.
            </p>
            <div className="flex space-x-6">
              {socialLinks.map((item) => (
                <Link key={item.name} href={item.href} className="text-gray-400 hover:text-gray-300">
                  <span className="sr-only">{item.name}</span>
                  <item.icon className="h-6 w-6" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </div>

          {/* Navigation Links */}
          <div className="mt-16 grid grid-cols-2 gap-8 xl:col-span-2 xl:mt-0">
            <div className="md:grid md:grid-cols-2 md:gap-8">
              <div>
                <h3 className="text-sm font-semibold leading-6 text-white">Product</h3>
                <ul role="list" className="mt-6 space-y-4">
                  {footerNav.product.map((item) => (
                    <li key={item.name}>
                      <Link href={item.href} className="text-sm leading-6 text-gray-300 hover:text-white">
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-10 md:mt-0">
                <h3 className="text-sm font-semibold leading-6 text-white">Company</h3>
                <ul role="list" className="mt-6 space-y-4">
                  {footerNav.company.map((item) => (
                    <li key={item.name}>
                      <Link href={item.href} className="text-sm leading-6 text-gray-300 hover:text-white">
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="md:grid md:grid-cols-2 md:gap-8">
              <div>
                <h3 className="text-sm font-semibold leading-6 text-white">Resources</h3>
                <ul role="list" className="mt-6 space-y-4">
                  {footerNav.resources.map((item) => (
                    <li key={item.name}>
                      <Link href={item.href} className="text-sm leading-6 text-gray-300 hover:text-white">
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-10 md:mt-0">
                <h3 className="text-sm font-semibold leading-6 text-white">Legal</h3>
                <ul role="list" className="mt-6 space-y-4">
                  {footerNav.legal.map((item) => (
                    <li key={item.name}>
                      <Link href={item.href} className="text-sm leading-6 text-gray-300 hover:text-white">
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Copyright */}
        <div className="mt-16 border-t border-white/10 pt-8 sm:mt-20 lg:mt-24">
          <p className="text-xs leading-5 text-gray-400">
            &copy; {new Date().getFullYear()} Arsip Cerdas Indonesia. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
} 