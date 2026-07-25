export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const {
    db,
    message = 'Update coalition database',
    path = 'data/default-db.json',
    githubRepository,
    githubBranch
  } = req.body || {};

  if (!db || typeof db !== 'object') {
    res.status(400).json({ error: 'Missing database payload' });
    return;
  }

  try {
    const { Octokit } = await import('octokit');
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      res.status(500).json({ error: 'Missing GITHUB_TOKEN. Set it as a secret environment variable in your hosting platform.' });
      return;
    }

    const octokit = new Octokit({ auth: token });
    const repository = githubRepository || process.env.GITHUB_REPOSITORY || 'Doronshorer/coalition-builder';
    const branch = githubBranch || process.env.GITHUB_BRANCH || 'main';
    const [owner, repo] = repository.split('/');

    if (!owner || !repo) {
      res.status(400).json({ error: 'Invalid GitHub repository format. Expected owner/repo.' });
      return;
    }

    const content = Buffer.from(JSON.stringify(db, null, 2) + '\n', 'utf8').toString('base64');

    let sha;
    try {
      const { data: existingFile } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref: branch
      });
      sha = existingFile?.sha;
    } catch (contentError) {
      if (contentError?.status !== 404) {
        throw contentError;
      }
    }

    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message,
      content,
      sha,
      branch
    });

    res.status(200).json({ ok: true, path, message, repository, branch });
  } catch (error) {
    const message = error?.message || 'Failed to save database';
    res.status(500).json({ error: message });
  }
}
