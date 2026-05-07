// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import rehypeExternalLinks from 'rehype-external-links';

function escapeHtml(s) {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

function remarkMermaid() {
	return (tree) => {
		const walk = (node) => {
			if (!Array.isArray(node.children)) return;
			for (let i = 0; i < node.children.length; i++) {
				const child = node.children[i];
				if (child.type === 'code' && child.lang === 'mermaid') {
					node.children[i] = {
						type: 'html',
						value: `<pre class="mermaid">${escapeHtml(child.value)}</pre>`,
					};
				} else {
					walk(child);
				}
			}
		};
		walk(tree);
	};
}

// https://astro.build/config
export default defineConfig({
	markdown: {
		remarkPlugins: [remarkMermaid],
		rehypePlugins: [
			[rehypeExternalLinks, { target: '_blank', rel: ['noopener', 'noreferrer'] }],
		],
	},
	integrations: [
		starlight({
			title: 'Labour Help Manitoba',
			description:
				'A plain-language guide to Employment Standards rights and claims in Manitoba for non-unionized workers.',
			logo: {
				src: './src/assets/manitoba-flag.svg',
				alt: 'Flag of Manitoba',
			},
			editLink: {
				baseUrl: 'https://github.com/ctataryn/labourhelp-site/edit/main/',
			},
			components: {
				EditLink: './src/components/EmptyEditLink.astro',
				SocialIcons: './src/components/SocialIcons.astro',
			},
			head: [
				{
					tag: 'script',
					attrs: { type: 'module' },
					content: `
						if (document.querySelector('pre.mermaid, .mermaid')) {
							const { default: mermaid } = await import('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs');
							const isDark = document.documentElement.dataset.theme === 'dark';
							mermaid.initialize({ startOnLoad: true, theme: isDark ? 'dark' : 'neutral' });
						}
					`,
				},
			],
			sidebar: [
				{
					label: 'Start Here',
					items: [
						{ label: 'Welcome', slug: 'index' },
						{ label: 'About This Site', slug: 'about' },
					],
				},
				{
					label: 'Your Rights',
					items: [
						{
							label: 'Overview',
							items: [
								{ label: 'What Are Employment Standards?', slug: 'rights/overview' },
								{ label: 'For Newcomers to Canada', slug: 'rights/newcomers' },
							],
						},
						{
							label: 'Workplace Structure',
							items: [
								{ label: 'Unions vs. the Rest of Us', slug: 'rights/unions-vs-non-union' },
								{
									label: 'HR at Your Employer',
									items: [
										{ label: 'The Role of Human Resources', slug: 'rights/role-of-hr' },
										{ label: 'Filing a Complaint With CPHR Manitoba', slug: 'rights/role-of-hr/cphr' },
									],
								},
							],
						},
						{
							label: 'On the Job',
							items: [
								{ label: 'Hours of Work and Overtime', slug: 'rights/overtime-and-hours' },
								{ label: 'Time Off: Vacation, Holidays, Leave', slug: 'rights/time-off' },
							],
						},
						{
							label: 'Ending Employment',
							items: [
								{ label: 'Termination: With Cause, Without Cause, Layoffs', slug: 'rights/termination' },
								{ label: 'Constructive Dismissal', slug: 'rights/constructive-dismissal' },
							],
						},
					],
				},
				{
					label: 'Filing a Claim',
					items: [
						{
							label: 'Before You File',
							items: [
								{ label: 'When to File a Claim', slug: 'claims/when-to-file' },
								{ label: 'Reservations and Hesitations', slug: 'claims/reservations' },
							],
						},
						{
							label: 'Filing the Claim',
							items: [
								{ label: 'How to File a Claim', slug: 'claims/how-to-file' },
								{ label: 'Evidence and Documentation', slug: 'claims/evidence-and-documentation' },
							],
						},
						{
							label: "After You've Filed",
							items: [
								{ label: 'What the Process Looks Like', slug: 'claims/the-process' },
								{ label: 'Expected Timelines', slug: 'claims/timelines' },
								{ label: 'Appeals and the Labour Board', slug: 'claims/appeals-and-labour-board' },
							],
						},
					],
				},
				{
					label: 'Beyond the Basics',
					items: [
						{ label: 'Advocacy: Reforms We Want', slug: 'advocacy' },
						{ label: 'Resources', slug: 'resources' },
					],
				},
			],
		}),
	],
});
