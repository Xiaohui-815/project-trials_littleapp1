import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { ArrowDownLeft, ArrowUpRight, BarChart3, CalendarDays, Check, ChevronLeft, ChevronRight, ClipboardList, Cloud, Coins, FileText, LayoutDashboard, LoaderCircle, LogOut, Pencil, Plus, RefreshCw, ShieldCheck, Trash2, X } from 'lucide-react';
import { beijingDate, formatPoints, inputPoints, validateRecord } from '../cloudfunctions/points-ledger/domain.mjs';
import { ApiError, createClient } from './lib/client';
import type { Account, Income, IncomeInput, LedgerClient, RecordPage, Summary } from './types';

type Route = 'overview' | 'records' | 'statistics';
const navigation = [
  { id: 'overview' as const, label: '积分概览', icon: LayoutDashboard },
  { id: 'records' as const, label: '收入明细', icon: ClipboardList },
  { id: 'statistics' as const, label: '月度与年度统计', icon: BarChart3 },
];
const getRoute = (): Route => {
  const value = location.hash.slice(2).split('?')[0];
  return ['records', 'statistics'].includes(value) ? value as Route : 'overview';
};
const messageOf = (error: unknown) => error instanceof Error ? error.message : '操作未完成，请稍后重试。';

export default function App() {
  const [client, setClient] = useState<LedgerClient | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [route, setRoute] = useState<Route>(getRoute);
  useEffect(() => {
    const update = () => setRoute(getRoute());
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    (async () => {
      try {
        const nextClient = await createClient();
        const user = await nextClient.getAccount();
        if (!active) return;
        setClient(nextClient); setAccount(user);
        unsubscribe = nextClient.onAccountChange(next => { if (active) setAccount(next); });
        // Remove consumed callback parameters, so tokens/codes never survive in copied links.
        if (new URLSearchParams(location.search).has('code') && user) {
          history.replaceState(null, '', `${import.meta.env.BASE_URL}${location.hash || '#/overview'}`);
        }
      } catch (err) { if (active) setError(messageOf(err)); }
      finally { if (active) setReady(true); }
    })();
    return () => { active = false; unsubscribe(); };
  }, []);
  async function login() {
    if (!client || busy) return;
    setBusy(true); setError('');
    try { await client.signIn(); } catch (err) { setError(messageOf(err)); }
    finally { setBusy(false); }
  }
  async function logout() {
    if (!client || busy) return;
    setBusy(true); setError('');
    try { await client.signOut(); setAccount(null); } catch (err) { setError(messageOf(err)); }
    finally { setBusy(false); }
  }
  return <div className="app-shell">
    <a className="skip-link" href="#workspace">跳至内容</a>
    <aside className="sidebar">
      <a className="brand" href="#/overview"><span className="brand-mark"><BarChart3 size={24} strokeWidth={2.5} /></span><span>经营积分<span className="brand-subtitle">个人收入账本</span></span></a>
      <div className="nav-caption">我的账本</div>
      <nav aria-label="主导航">{navigation.map(({ id, label, icon: Icon }) => <a key={id} href={`#/${id}`} aria-current={route === id ? 'page' : undefined} className={`nav-item ${route === id ? 'active' : ''}`}><Icon size={19} /><span>{label}</span></a>)}</nav>
      <div className="sidebar-bottom">
        <div className="privacy-note"><ShieldCheck size={19} /><div>独立的个人账本<small>仅你可以查看自己的记录</small></div></div>
        <div className="account"><div className="avatar">{account ? account.email.slice(0, 1).toUpperCase() : '访'}</div><div className="account-copy"><strong>{account ? (client?.preview ? '预览账号' : '我的账号') : '尚未登录'}</strong><span title={account?.email}>{account?.email || '登录后开始记录'}</span></div>{account && <button className="icon-button" disabled={busy} onClick={logout} aria-label="退出登录" title="退出登录"><LogOut size={17} /></button>}</div>
      </div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb">我的账本<span>/</span><strong>{navigation.find(n => n.id === route)?.label}</strong></div><div className="topbar-right"><span className="test-badge">测试版</span><span className="date-label"><CalendarDays size={15} />{beijingDate().replaceAll('-', '.')}</span></div></header>
      <main id="workspace" tabIndex={-1}>
        {client?.preview && <div className="preview-banner"><FileText size={16} />界面预览 · 当前为示例数据，刷新后重置，不会保存到云端。</div>}
        {error && <ErrorNotice message={error} onRetry={() => location.reload()} />}
        {!ready ? <div className="page-loading" role="status"><LoaderCircle className="spin" />正在连接你的账本…</div> : !account ? <Welcome configured={Boolean(client?.configured)} busy={busy} onLogin={login} /> : client && <Workspace key={account.id} route={route} client={client} onExpired={() => { setAccount(null); setError('登录已过期，请重新登录。'); }} />}
      </main>
      <footer className="page-footer"><span>经营积分账本</span><span>统计时间：北京时间 · 积分保留两位小数</span></footer>
    </div>
  </div>;
}

function Welcome({ configured, busy, onLogin }: { configured: boolean; busy: boolean; onLogin: () => void }) {
  return <section className="welcome">
    <div className="welcome-copy"><span className="eyebrow">PERSONAL POINTS LEDGER</span><h1>把每一笔积分，<br />记得清清楚楚。</h1><p>记录经营收入，查看每月变化。<br />用一份账本，看清自己的积累。</p><div className="welcome-features"><span><Check size={16} />按月与按年统计</span><span><Check size={16} />多设备同步</span><span><Check size={16} />个人数据独立保存</span></div></div>
    <div className="signin-card"><span className="signin-icon"><Coins size={28} /></span><h2>{configured ? '打开你的积分账本' : '账本已就绪，等待连接'}</h2><p>{configured ? '使用邮箱账号登录。还没有账号？可以在登录页面完成注册。' : '网站的测试环境尚未配置完成。连接账号服务后，即可注册并开始记账。'}</p><button className="button primary large" disabled={!configured || busy} onClick={onLogin}>{busy ? <LoaderCircle size={18} className="spin" /> : <ArrowUpRight size={18} />}{configured ? '登录 / 注册' : '等待开通测试环境'}</button>{configured && <button className="text-button recovery-link" onClick={onLogin} disabled={busy}>忘记密码？前往账号页面找回</button>}<div className="signin-foot"><ShieldCheck size={16} />{configured ? '在腾讯云认证页面安全完成登录' : '暂未收集账号信息或保存个人记录'}</div></div>
  </section>;
}

function Workspace({ route, client, onExpired }: { route: Route; client: LedgerClient; onExpired: () => void }) {
  const today = beijingDate();
  const currentYear = Number(today.slice(0, 4));
  const currentMonth = Number(today.slice(5, 7));
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState<number | undefined>(currentMonth);
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [list, setList] = useState<RecordPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [editor, setEditor] = useState<Income | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Income | null>(null);
  const [notice, setNotice] = useState('');
  const displayedYear = route === 'overview' ? currentYear : year;
  const displayedMonth = route === 'overview' ? undefined : month;
  const pageSize = route === 'overview' ? 5 : 10;
  const expiredRef = useRef(onExpired);
  expiredRef.current = onExpired;
  useEffect(() => { setPage(1); }, [route]);
  useEffect(() => {
    let active = true;
    setLoading(true); setLoadError(''); setList(null); setSummary(null);
    Promise.all([client.summary(displayedYear), client.list({ year: displayedYear, month: displayedMonth, page: route === 'overview' ? 1 : page, pageSize })])
      .then(([nextSummary, nextList]) => {
        if (!active) return;
        if (nextList.total > 0 && nextList.records.length === 0 && page > 1) { setPage(p => p - 1); return; }
        setSummary(nextSummary); setList(nextList);
      }).catch(error => {
        if (!active) return;
        if (error instanceof ApiError && error.code === 'UNAUTHENTICATED') expiredRef.current();
        else setLoadError(messageOf(error));
      }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [client, displayedYear, displayedMonth, route, page, pageSize, refresh]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  const openMonth = (m: number) => { setMonth(m); setYear(displayedYear); setPage(1); location.hash = '/statistics'; };
  const chosenMonth = route === 'overview' ? currentMonth : month;
  const selected = chosenMonth ? summary?.months[chosenMonth - 1] : null;
  const title = navigation.find(n => n.id === route)?.label;
  return <>
    <div className="page-heading"><div><div className="eyebrow">{route === 'overview' ? 'OVERVIEW' : route === 'records' ? 'INCOME RECORDS' : 'STATISTICS'}</div><h1>{title}</h1><p>{route === 'overview' ? '每一笔经营收入，都是看得见的积累。' : route === 'records' ? '管理收入记录，让每一笔积分都有出处。' : '按月回顾收入，看清一整年的经营积累。'}</p></div><button className="button primary" onClick={() => setEditor('new')}><Plus size={18} />新增收入</button></div>
    {route !== 'overview' && <div className="filter-bar"><div className="filter-controls"><CalendarDays size={18} /><label>年份<select aria-label="选择年份" value={year} onChange={event => { setYear(Number(event.target.value)); setPage(1); }}>{Array.from({ length: currentYear - 1899 }, (_, i) => currentYear - i).map(y => <option key={y} value={y}>{y} 年</option>)}</select></label><label>月份<select aria-label="选择月份" value={month || ''} onChange={event => { setMonth(event.target.value ? Number(event.target.value) : undefined); setPage(1); }}><option value="">全年</option>{Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m} 月</option>)}</select></label></div><button className="button subtle" onClick={() => setRefresh(r => r + 1)} disabled={loading}><RefreshCw size={16} className={loading ? 'spin' : ''} />刷新</button></div>}
    {loadError ? <ErrorNotice message={loadError} onRetry={() => setRefresh(r => r + 1)} /> : <>
      <section className="metrics" aria-label="积分收入汇总" aria-busy={loading}>
        <Metric primary icon={<Coins size={22} />} label={chosenMonth ? `${route === 'overview' ? '本月' : `${chosenMonth} 月`}积分收入` : '全年积分收入'} value={loading ? null : formatPoints(selected?.pointsMinor ?? summary?.totalMinor ?? 0)} unit="积分" detail={chosenMonth ? `${displayedYear} 年 ${chosenMonth} 月 · ${selected?.count ?? 0} 笔收入` : `${displayedYear} 年度累计`} />
        <Metric icon={<BarChart3 size={21} />} label={`${route === 'overview' ? '今年' : `${displayedYear} 年`}累计收入`} value={loading ? null : formatPoints(summary?.totalMinor ?? 0)} unit="积分" detail="按收入发生日期统计" />
        <Metric icon={<ClipboardList size={21} />} label="年度收入笔数" value={loading ? null : String(summary?.count ?? 0)} unit="笔" detail={summary?.count ? '每一笔，都有所积累' : '从第一笔记录开始'} />
      </section>
      {route !== 'records' && <section className="panel chart-panel"><div className="panel-heading"><div><h2>月度收入趋势</h2><p>{displayedYear} 年 · 点击月份查看明细</p></div><span className="chart-legend"><i />积分收入</span></div>{loading ? <div className="chart-placeholder skeleton" /> : summary && <MonthChart summary={summary} selected={chosenMonth} onSelect={openMonth} />}</section>}
      <section className="panel records-panel"><div className="panel-heading"><div><h2>{route === 'overview' ? '最近收入' : `${month ? `${month} 月` : '全年'}收入明细`}<span className="count-badge">{list?.total ?? '—'}</span></h2><p>{route === 'overview' ? '按收入日期倒序排列' : `${displayedYear} 年${month ? ` ${month} 月` : ''}的积分收入记录`}</p></div>{route === 'overview' && <a className="text-button" href="#/records">查看全部<ChevronRight size={16} /></a>}</div>
        <IncomeTable list={list} loading={loading} onEdit={setEditor} onDelete={setDeleting} onAdd={() => setEditor('new')} />
        {route !== 'overview' && list && list.total > 0 && <div className="pagination"><span>共 {list.total} 笔 · 每页 {pageSize} 笔</span><div><button className="icon-button" aria-label="上一页" disabled={page === 1 || loading} onClick={() => setPage(p => p - 1)}><ChevronLeft size={17} /></button><span>第 {page} / {Math.max(1, Math.ceil(list.total / pageSize))} 页</span><button className="icon-button" aria-label="下一页" disabled={page * pageSize >= list.total || loading} onClick={() => setPage(p => p + 1)}><ChevronRight size={17} /></button></div></div>}
      </section>
    </>}
    {editor && <IncomeEditor record={editor === 'new' ? null : editor} client={client} onClose={() => setEditor(null)} onSaved={() => { setNotice(editor === 'new' ? '收入已保存' : '记录已更新'); setEditor(null); setRefresh(r => r + 1); }} />}
    {deleting && <DeleteDialog record={deleting} client={client} onClose={() => setDeleting(null)} onDeleted={() => { setDeleting(null); setNotice('记录已删除，统计已更新'); setRefresh(r => r + 1); }} />}
    {notice && <div className="toast" role="status"><Check size={18} />{notice}</div>}
  </>;
}

function Metric({ primary, icon, label, value, unit, detail }: { primary?: boolean; icon: ReactNode; label: string; value: string | null; unit: string; detail: string }) {
  return <article className={`metric ${primary ? 'metric-primary' : ''}`}><div className="metric-top"><span>{label}</span><span className="metric-icon">{icon}</span></div><div className="metric-value">{value === null ? <span className="skeleton metric-skeleton" /> : <><strong>{value}</strong><span>{unit}</span></>}</div><div className="metric-detail">{primary && <ArrowDownLeft size={15} />}{detail}</div></article>;
}

function MonthChart({ summary, selected, onSelect }: { summary: Summary; selected?: number; onSelect: (month: number) => void }) {
  const max = Math.max(10000, ...summary.months.map(m => m.pointsMinor));
  const ceiling = Math.ceil(max / 10000) * 10000;
  const axis = (value: number) => value / 100 >= 10000 ? `${Math.round(value / 10000) / 100}万` : (value / 100).toLocaleString('zh-CN');
  return <div className="chart" role="group" aria-label={`${summary.year} 年每月积分收入柱状图`}>
    <div className="chart-axis"><span>{axis(ceiling)}</span><span>{axis(ceiling / 2)}</span><span>0</span></div>
    <div className="chart-plot"><div className="chart-grid"><i /><i /><i /></div><div className="chart-columns">{summary.months.map(item => <button key={item.month} className={`chart-column ${selected === item.month ? 'selected' : ''}`} onClick={() => onSelect(item.month)} aria-label={`${item.month} 月收入 ${formatPoints(item.pointsMinor)} 积分，${item.count} 笔，查看明细`}><div className="bar-area"><span className="bar-tooltip">{formatPoints(item.pointsMinor)} 积分</span><span className={`bar ${item.pointsMinor ? '' : 'bar-zero'}`} style={{ height: `${Math.max(item.pointsMinor ? 2 : 0.7, item.pointsMinor / ceiling * 100)}%` }} /></div><span className="month-label">{item.month} 月</span></button>)}</div></div>
  </div>;
}

function IncomeTable({ list, loading, onEdit, onDelete, onAdd }: { list: RecordPage | null; loading: boolean; onEdit: (r: Income) => void; onDelete: (r: Income) => void; onAdd: () => void }) {
  if (loading) return <div className="table-loading" role="status" aria-label="正在加载记录">{[0, 1, 2].map(i => <div key={i} className="skeleton" />)}</div>;
  if (!list?.records.length) return <div className="empty-state"><span><FileText size={30} /></span><h3>这段时间还没有收入记录</h3><p>新增一笔收入，月度与年度统计会自动更新。</p><button className="button secondary" onClick={onAdd}><Plus size={16} />记录第一笔收入</button></div>;
  return <div className="table-scroll"><table><thead><tr><th scope="col">收入日期</th><th scope="col">收入来源</th><th scope="col">备注</th><th scope="col" className="numeric">积分收入</th><th scope="col" className="actions-heading">操作</th></tr></thead><tbody>{list.records.map(record => <tr key={record.id}><td className="record-date">{record.incomeDate.replaceAll('-', '.')}</td><td><span className="source-cell"><span className="source-icon"><ArrowDownLeft size={16} /></span>{record.source}</span></td><td className="record-note"><span title={record.note}>{record.note || '—'}</span></td><td className="numeric record-points">+{formatPoints(record.pointsMinor)}</td><td className="row-actions"><button className="icon-button" aria-label={`编辑 ${record.source} ${record.incomeDate}`} title="编辑" onClick={() => onEdit(record)}><Pencil size={16} /></button><button className="icon-button danger-icon" aria-label={`删除 ${record.source} ${record.incomeDate}`} title="删除" onClick={() => onDelete(record)}><Trash2 size={16} /></button></td></tr>)}</tbody></table></div>;
}

function Modal({ title, children, onClose, busy }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement as HTMLElement;
    dialog.showModal();
    return () => { dialog.close(); previous?.focus(); };
  }, []);
  return <dialog ref={ref} className="modal" aria-labelledby="modal-title" onCancel={e => { e.preventDefault(); if (!busy) closeRef.current(); }}><div className="modal-heading"><h2 id="modal-title">{title}</h2><button type="button" className="icon-button" aria-label="关闭窗口" disabled={busy} onClick={onClose}><X size={20} /></button></div>{children}</dialog>;
}

function IncomeEditor({ record, client, onClose, onSaved }: { record: Income | null; client: LedgerClient; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<IncomeInput>({ incomeDate: record?.incomeDate || beijingDate(), points: record ? inputPoints(record.pointsMinor) : '', source: record?.source || '', note: record?.note || '', requestId: crypto.randomUUID(), id: record?.id, version: record?.version });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const setField = useCallback((key: string, value: string) => setForm(f => ({ ...f, [key]: value })), []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    try { validateRecord(form); } catch (err) { setError(messageOf(err)); return; }
    inFlight.current = true; setBusy(true); setError('');
    try { await client.save(form); onSaved(); }
    catch (err) { setError(messageOf(err)); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <Modal title={record ? '编辑收入' : '新增收入'} onClose={onClose} busy={busy}><form onSubmit={submit} noValidate><p className="modal-description">填写收入发生日期，积分将自动计入对应月份。</p><fieldset disabled={busy} className="form-fields"><div className="form-row"><label>收入日期 <span>*</span><input type="date" name="incomeDate" required min="1900-01-01" max={beijingDate()} value={form.incomeDate} onChange={e => setField('incomeDate', e.target.value)} /></label><label>积分数 <span>*</span><div className="input-unit"><input name="points" inputMode="decimal" placeholder="0.00" autoFocus required value={form.points} onChange={e => setField('points', e.target.value)} /><span>积分</span></div></label></div><label>收入来源 <span>*</span><input name="source" placeholder="例如：日常经营、客户推荐" maxLength={60} required value={form.source} onChange={e => setField('source', e.target.value)} /></label><label>备注 <small>选填</small><textarea name="note" placeholder="补充这笔收入的相关信息" maxLength={500} rows={3} value={form.note} onChange={e => setField('note', e.target.value)} /></label><div className="field-hint">积分大于 0，最多保留两位小数。</div></fieldset>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>取消</button><button type="submit" className="button primary" disabled={busy}>{busy ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />}{busy ? '正在保存…' : '保存收入'}</button></div></form></Modal>;
}

function DeleteDialog({ record, client, onClose, onDeleted }: { record: Income; client: LedgerClient; onClose: () => void; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  async function remove() {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try { await client.remove(record); onDeleted(); }
    catch (err) { setError(messageOf(err)); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <Modal title="删除这笔收入？" onClose={onClose} busy={busy}><p className="modal-description">删除后无法恢复，月度和年度统计也会相应更新。</p><div className="delete-summary"><span>{record.incomeDate} · {record.source}</span><strong>{formatPoints(record.pointsMinor)} 积分</strong></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button className="button secondary" disabled={busy} onClick={onClose} autoFocus>保留记录</button><button className="button danger" disabled={busy} onClick={remove}>{busy ? '正在删除…' : '确认删除'}</button></div></Modal>;
}

function ErrorNotice({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="error-notice" role="alert"><Cloud size={20} /><span>{message}</span><button className="text-button" onClick={onRetry}>重试</button></div>;
}
