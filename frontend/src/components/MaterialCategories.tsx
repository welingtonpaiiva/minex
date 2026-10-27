type Category = { id: number | null; nome: string; total: number };

export function MaterialCategories({ categories, value, onChange }: {
  categories: Category[];
  value: string;
  onChange: (value: string) => void;
}) {
  const total = categories.reduce((sum, category) => sum + Number(category.total), 0);
  return <section className="stock-category-section" aria-label="Categorias de materiais">
    <div className="category-section-heading"><h2>Categorias</h2><span>Total de materiais cadastrados</span></div>
    <div className="stock-categories">
      <button type="button" className={'category-card ' + (!value ? 'active' : '')} aria-pressed={!value} onClick={() => onChange('')}>
        <span>Todas as categorias</span><strong>{total}</strong>
      </button>
      {categories.map(category => {
        const key = category.id === null ? 'sem-categoria' : String(category.id);
        return <button type="button" key={key} className={'category-card ' + (value === key ? 'active' : '')} aria-pressed={value === key} onClick={() => onChange(key)}>
          <span>{category.nome}</span><strong>{category.total}</strong>
        </button>;
      })}
    </div>
  </section>;
}

export function MaterialCategoryRow({ item, previous, columns }: { item: any; previous?: any; columns: number }) {
  if (previous && previous.categoria_id === item.categoria_id) return null;
  return <tr className="material-category-row"><th colSpan={columns} scope="rowgroup">{item.categoria_nome || 'Sem categoria'}</th></tr>;
}
