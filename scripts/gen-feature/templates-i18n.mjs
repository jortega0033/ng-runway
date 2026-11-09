// i18n texts for a generated feature: English and Dutch, written as plain objects and saved as
// JSON. This file is normal JavaScript (no generated-code escapes needed).
//
// The Dutch avoids sentences where the entity name would have to be inflected ("nieuw" or
// "nieuwe"), so it reads correctly whatever the feature is called. The entity name itself is
// inserted as typed, for example "Order toevoegen".

/** The object behind `public/i18n/<name>/<lang>.json`. Keys have no scope prefix (Transloco adds it). */
export function texts(n, lang) {
  const en = lang === 'en';
  const plural = n.lower;
  const singular = n.lowerSingular;
  return {
    breadcrumb: en ? 'Breadcrumb' : 'Kruimelpad',
    status: {
      draft: en ? 'Draft' : 'Concept',
      active: en ? 'Active' : 'Actief',
      archived: en ? 'Archived' : 'Gearchiveerd',
    },
    fields: {
      name: en ? 'Name' : 'Naam',
      owner: en ? 'Owner' : 'Eigenaar',
      status: 'Status',
      amount: en ? 'Amount' : 'Bedrag',
      createdAt: en ? 'Created on' : 'Aangemaakt op',
    },
    list: {
      title: n.title,
      description: en
        ? `All ${plural} with status, owner and amount.`
        : `Alle ${plural} met status, eigenaar en bedrag.`,
      new: en ? `New ${singular}` : `${n.titleSingular} toevoegen`,
      search: en ? 'Search' : 'Zoeken',
      searchPlaceholder: en ? 'Name or owner' : 'Naam of eigenaar',
      status: 'Status',
      allStatuses: en ? 'All statuses' : 'Alle statussen',
      clear: en ? 'Clear filters' : 'Filters wissen',
      tableLabel: n.title,
      emptyTitle: en ? `No ${plural} yet` : `Nog geen ${plural}`,
      emptyText: en
        ? `Add the first ${singular} to get started.`
        : 'Voeg de eerste toe om aan de slag te gaan.',
      noMatchTitle: en ? `No ${plural} found` : `Geen ${plural} gevonden`,
      summary: en ? `${n.title} found: {{ count }}` : 'Gevonden: {{ count }}',
      columns: {
        name: en ? 'Name' : 'Naam',
        owner: en ? 'Owner' : 'Eigenaar',
        status: 'Status',
        amount: en ? 'Amount' : 'Bedrag',
        createdAt: en ? 'Created' : 'Aangemaakt',
      },
      pagination: {
        label: en ? 'Pagination' : 'Paginering',
        previous: en ? 'Previous page' : 'Vorige pagina',
        next: en ? 'Next page' : 'Volgende pagina',
        pageSize: en ? 'Rows per page' : 'Rijen per pagina',
        page: en ? 'Page {{ page }}' : 'Pagina {{ page }}',
      },
    },
    detail: {
      errorTitle: en ? `Could not load this ${singular}` : 'Kan dit niet laden',
      backToList: en ? `Back to ${plural}` : 'Terug naar de lijst',
    },
    form: {
      newTitle: en ? `New ${singular}` : `${n.titleSingular} toevoegen`,
      editTitle: en ? `Edit ${singular}` : `${n.titleSingular} bewerken`,
      name: en ? 'Name' : 'Naam',
      owner: en ? 'Owner' : 'Eigenaar',
      status: 'Status',
      amount: en ? 'Amount (EUR)' : 'Bedrag (EUR)',
      amountHint: en ? 'For example 125.50' : 'Bijvoorbeeld 125,50',
      created: en ? 'Saved' : 'Opgeslagen',
      updated: en ? 'Changes saved' : 'Wijzigingen opgeslagen',
      saveFailed: en ? 'Could not save' : 'Opslaan is mislukt',
      fixErrors: en ? 'Check the form' : 'Controleer het formulier',
      fixErrorsText: en
        ? 'Some fields need your attention before you can save.'
        : 'Een aantal velden moet worden aangepast voordat je kunt opslaan.',
      errors: {
        required: en ? 'This field is required.' : 'Dit veld is verplicht.',
        minLength: en ? 'Use at least 2 characters.' : 'Gebruik minimaal 2 tekens.',
        number: en
          ? 'Enter a number, for example 125.50.'
          : 'Vul een getal in, bijvoorbeeld 125,50.',
        range: en ? 'The amount is too high.' : 'Het bedrag is te hoog.',
      },
    },
    delete: {
      title: en ? `Delete this ${singular}?` : 'Verwijderen?',
      message: en
        ? 'Delete {{ name }}? This cannot be undone.'
        : '{{ name }} verwijderen? Dit kan niet ongedaan worden gemaakt.',
      done: en ? 'Deleted' : 'Verwijderd',
    },
  };
}

/** File content for `public/i18n/<name>/<lang>.json`: 2-space JSON with a trailing newline. */
export function i18nTemplate(n, lang) {
  return `${JSON.stringify(texts(n, lang), null, 2)}\n`;
}

/**
 * The label of the sidebar entry, added to `nav` in the GLOBAL `public/i18n/<lang>.json`.
 * Both languages use the name as typed ("Orders"); change the Dutch by hand if a better word exists.
 */
export function navLabel(n) {
  return n.title;
}
