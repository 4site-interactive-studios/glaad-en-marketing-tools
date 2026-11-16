/**
 * Example emails for the preview page, assembled from the blocks in
 * main.mjml. The build copies each named block's markup straight out of the
 * catalog (scripts/lib/shared.mjs, composeExample), so an example can never
 * drift from the block it shows; only the overrides below differ.
 *
 * Each entry in `blocks` is a block name from main.mjml, or an object:
 *   { block: 'Body Copy', text: '<p>…</p>' }   replaces the content of the
 *                                               block's first mj-text
 *   { block: 'CTA Button', replace: [[find, replacement], …] }
 *                                               plain-text swaps; each find
 *                                               must occur exactly once
 * The first example is the preview's default. Sample copy only: these are
 * demonstrations, not approved GLAAD messages.
 */
export const EXAMPLES = [
  {
    id: 'year-end-appeal',
    title: 'Year-end appeal',
    blocks: [
      'CTA Header',
      'Match Banner',
      {
        block: 'Body Copy',
        text: `
          <p>Dear Friend,</p>
          <p>As the year comes to a close, we're asking the people who make GLAAD's work possible to help us finish strong.</p>
          <p>Every day, GLAAD works to make sure LGBTQ people are seen and represented with accuracy and respect, in the news, on screen and online. Your support is what keeps that work going.</p>
          <p>Make a gift before December 31 and it will be matched dollar for dollar, so your support goes twice as far. Choose an amount below to get started.</p>`,
      },
      'Gift Amount Buttons 4x1',
      'Signature (no photo)',
      'Social Links',
      'Footer',
    ],
  },
  {
    id: 'welcome',
    title: 'Welcome email',
    blocks: [
      'Logo Header',
      'Body Copy',
      {
        block: 'Signature (no photo)',
        text: `
          <p><em>With Kind Regards,</em></p>
          <p><strong>GLAAD Donor Services</strong></p>`,
      },
      'Social Links',
      'Footer',
    ],
  },
  {
    id: 'news-update',
    title: 'News update',
    blocks: [
      'Logo Header',
      'Image (full width)',
      {
        block: 'Body Copy',
        text: `
          <h2>This month at GLAAD</h2>
          <p>Here's a quick look at the work your support makes possible: holding the media accountable for fair and accurate coverage, celebrating LGBTQ stories, and showing up wherever acceptance is on the line.</p>
          <p>Read the full update for the stories behind this month's work.</p>`,
      },
      {
        block: 'CTA Button',
        replace: [
          ['>DONATE NOW<', '>READ THE UPDATE<'],
          ['href="https://give.glaad.org/page/50945/donate/1?chain"', 'href="https://glaad.org/"'],
        ],
      },
      'Image (indented)',
      {
        block: 'Body Copy',
        text: `
          <h3>Stay connected</h3>
          <p>Share this update with a friend, and follow GLAAD on social media for news as it happens.</p>`,
      },
      'Social Links',
      'Footer',
    ],
  },
];
