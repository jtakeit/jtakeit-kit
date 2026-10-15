# Security

The kit runs in a site's build and in a visitor's browser; the platform it
talks to is not in this repository. A vulnerability in the kit — the forms,
the elements, the catalogue tool, the lint — is reported privately through
GitHub: **Security → Report a vulnerability** on this repository. Please do
not open a public issue for it.

What a report needs: the version (`npm view @jtakeit/kit version`, or the
one in your lockfile), what the kit does that it should not, and how to
see it. A fix goes out as a patch release, and the advisory names the
versions it covers.

A vulnerability in the platform (the panel, the API, the edge) is reported
by email to hello@jtakeit.com, with "security" in the subject. Please do not
post it publicly.
