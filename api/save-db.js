export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { db, message = 'Update coalition database', path = 'data/default-db.json' } = req.body || {};

  if (!db || typeof db !== 'object') {
    res.status(400).json({ error: 'Missing database payload' });
    return;
  }

  try {
    const { Octokit } = await import('octokit');
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      res.status(500).json({ error: 'Missing GITHUB_TOKEN' });
      return;
    }

    const octokit = new Octokit({ auth: token });
    const [owner, repo] = (process.env.GITHUB_REPOSITORY || 'Doronshorer/coalition-builder').split('/');
    const branch = process.env.GITHUB_BRANCH || 'main';

    const content = Buffer.from(JSON.stringify(db, null, 2) + '\n', 'utf8').toString('base64');

    const { data: existingFile } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref: branch
    });

    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message,
      content,
      sha: existingFile?.sha,
      branch
    });

    res.status(200).json({ ok: true, path, message });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to save database' });
  }
}
