// Builds for GitHub Pages (/atelier/) and pushes dist/ to the gh-pages branch.
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const run = (cmd, opts = {}) => execSync(cmd, { stdio: 'inherit', ...opts })
run('npx vite build', { env: { ...process.env, BASE_PATH: '/atelier/', MSYS_NO_PATHCONV: '1' } })
writeFileSync('dist/.nojekyll', '')
const remote = execSync('git remote get-url origin').toString().trim()
run('git init -q -b gh-pages', { cwd: 'dist' })
run('git add -A', { cwd: 'dist' })
run('git -c user.name=Orbixel -c user.email=orbixel.agency@gmail.com commit -q -m "Publicar Atelier"', { cwd: 'dist' })
run(`git push -f ${remote} gh-pages`, { cwd: 'dist' })
console.log('Publicado: https://orbixelagency-wq.github.io/atelier/')
