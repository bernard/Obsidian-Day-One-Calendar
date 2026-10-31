import { App, ItemView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, TFolder, WorkspaceLeaf, moment, normalizePath } from 'obsidian';

const VIEW_TYPE = 'day-one-calendar-view';
type Level = 'year' | 'month' | 'day' | 'all-years' | 'all-years-day';
interface Settings { rootFolder: string; templatePath: string; templatesFolder: string; dateFormat: string; timeFormat: string; }
const DEFAULTS: Settings = {rootFolder:'Day-One',templatePath:'',templatesFolder:'',dateFormat:'YYYY-MM-DD',timeFormat:'HH:mm'};
const NAME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[ _]+(\d{4}(?:\d{2})?)(?:[ _-].*)?\.md$/i;
const pad = (n:number) => String(n).padStart(2,'0');
const MONTH_FOLDER_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const dateKey = (year:number, month:number, day:number) => `${year}-${pad(month)}-${pad(day)}`;
const isValidDate = (year:number,month:number,day:number) => {const d=new Date(year,month-1,day);return d.getFullYear()===year&&d.getMonth()===month-1&&d.getDate()===day;};

class CalendarView extends ItemView {
  plugin: DayOneCalendar;
  level: Level = 'year';
  year = new Date().getFullYear();
  month = new Date().getMonth()+1;
  day = new Date().getDate();
  aggregateMonth = new Date().getMonth()+1;
  aggregateDay = new Date().getDate();
  constructor(leaf:WorkspaceLeaf, plugin:DayOneCalendar){super(leaf);this.plugin=plugin;}
  getViewType(){return VIEW_TYPE;}
  getDisplayText(){return 'Day One Calendar';}
  getIcon(){return 'calendar-days';}
  async onOpen(){this.render();}
  refresh(){this.render();}
  private entries(): Map<string,TFile[]> {
    const result = new Map<string,TFile[]>();
    const configuredRoot=this.plugin.settings.rootFolder.trim().replace(/^\/+|\/+$/g,'').replace(/\\/g,'/');
    const root=configuredRoot.toLowerCase();
    for(const file of this.app.vault.getMarkdownFiles()){
      const path=file.path.replace(/\\/g,'/');
      const lower=path.toLowerCase();
      // Respect the selected journal folder, including folders with different capitalization.
      if(root && !lower.startsWith(root+'/')) continue;
      const relative=root?path.slice(configuredRoot.length+1):path;
      const pieces=relative.split('/');
      const match=NAME_PATTERN.exec(file.name);
      if(!match) continue;
      const y=Number(match[1]), mo=Number(match[2]), d=Number(match[3]);
      if(!isValidDate(y,mo,d))continue;
      // Support YYYY/MM, YYYY/M, YYYY/MonthName and notes in nested subfolders.
      const yearFolder=pieces.findIndex(part=>part===match[1]);
      if(yearFolder<0 || yearFolder>=pieces.length-2)continue;
      const monthFolder=pieces[yearFolder+1];
      const monthNumber=Number(monthFolder);
      const monthName=moment(`${y}-${pad(mo)}-01`).format('MMMM').toLowerCase();
      const monthShort=moment(`${y}-${pad(mo)}-01`).format('MMM').toLowerCase();
      if(!(monthNumber===mo || monthFolder.toLowerCase()===monthName || monthFolder.toLowerCase()===monthShort))continue;
      const key=dateKey(y,mo,d);
      if(!result.has(key))result.set(key,[]);
      result.get(key)!.push(file);
    }
    for(const files of result.values()) files.sort((a,b)=>a.name.localeCompare(b.name));
    return result;
  }
  private button(parent:HTMLElement,text:string,action:()=>void,cls=''){
    const btn=parent.createEl('button',{text,cls});btn.type='button';btn.addEventListener('click',action);return btn;
  }
  private render(){
    const root=this.contentEl;root.empty();root.addClass('doc-calendar');
    const all=this.entries();
    const header=root.createDiv({cls:'doc-header'});
    const heading=header.createDiv({cls:'doc-heading'});
    const title=heading.createEl('h2');
    title.setText(this.level==='all-years'?'All years':this.level==='all-years-day'?`All years · ${moment(`2000-${pad(this.aggregateMonth)}-${pad(this.aggregateDay)}`).format('MMMM D')}`:this.level==='year'?String(this.year):this.level==='month'?moment(`${this.year}-${pad(this.month)}-01`).format('MMMM YYYY'):moment(dateKey(this.year,this.month,this.day)).format('MMMM D, YYYY'));
    const controls=header.createDiv({cls:'doc-controls'});
    this.button(controls,this.level.startsWith('all-years')?'Single year':'All years',()=>{this.level=this.level.startsWith('all-years')?'year':'all-years';this.render();});
    this.button(controls,'Today',()=>{const d=new Date();this.year=d.getFullYear();this.month=d.getMonth()+1;this.day=d.getDate();this.level='day';this.render();});
    if(!this.level.startsWith('all-years')){
      this.button(controls,'‹',()=>this.shift(-1),'doc-arrow').setAttribute('aria-label','Previous');
      this.button(controls,'›',()=>this.shift(1),'doc-arrow').setAttribute('aria-label','Next');
    }
    if(this.level==='all-years-day')this.button(controls,'All years view',()=>{this.level='all-years';this.render();});
    else if(this.level!=='year' && this.level!=='all-years')this.button(controls,this.level==='day'?'Month view':'Year view',()=>{this.level=this.level==='day'?'month':'year';this.render();});
    const body=root.createDiv({cls:'doc-body'});
    if(all.size===0){const hint=body.createEl('p',{cls:'doc-empty-message'});hint.setText(`No journal entries found under “${this.plugin.settings.rootFolder}”. Check Settings → Day One Calendar → Journal root folder. Expected notes like Day-One/2026/10/2026-10-30 103000.md.`);}
    if(this.level==='all-years'){
      const aggregated=new Map<string,TFile[]>();
      for(const [key,files] of all){const md=key.slice(5);aggregated.set(md,[...(aggregated.get(md)??[]),...files]);}
      const grid=body.createDiv({cls:'doc-year-grid'});
      for(let m=1;m<=12;m++){
        const panel=grid.createDiv({cls:'doc-month-panel'});
        panel.createEl('h3',{cls:'doc-month-title',text:moment(`2000-${pad(m)}-01`).format('MMMM')});
        this.drawAggregateMonth(panel,m,aggregated);
      }
    }else if(this.level==='all-years-day'){
      const md=`${pad(this.aggregateMonth)}-${pad(this.aggregateDay)}`;
      const files=[...all.entries()].filter(([key])=>key.slice(5)===md).flatMap(([,files])=>files).sort((a,b)=>b.name.localeCompare(a.name));
      body.createEl('p',{cls:'doc-count',text:`${files.length} ${files.length===1?'entry':'entries'} across all years`});
      if(!files.length)body.createEl('p',{cls:'doc-empty-message',text:'No entries for this day across past years.'});
      for(const file of files){
        const item=body.createEl('button',{cls:'doc-entry'});
        item.createSpan({cls:'doc-entry-time',text:file.basename.slice(0,10)});
        item.createSpan({cls:'doc-entry-name',text:file.basename.slice(11)});
        item.addEventListener('click',()=>void this.app.workspace.getLeaf('tab').openFile(file));
      }
    }else if(this.level==='year'){
      const grid=body.createDiv({cls:'doc-year-grid'});
      for(let m=1;m<=12;m++){
        const panel=grid.createDiv({cls:'doc-month-panel'});
        const label=panel.createEl('button',{cls:'doc-month-title',text:moment(`${this.year}-${pad(m)}-01`).format('MMMM')});
        label.addEventListener('click',()=>{this.month=m;this.level='month';this.render();});
        this.drawMonth(panel,this.year,m,all,true);
      }
    }else if(this.level==='month')this.drawMonth(body,this.year,this.month,all,false);
    else this.drawDay(body,all);
  }
  private drawAggregateMonth(parent:HTMLElement,month:number,all:Map<string,TFile[]>){
    const grid=parent.createDiv({cls:'doc-days doc-compact'});
    for(const name of ['S','M','T','W','T','F','S'])grid.createDiv({cls:'doc-weekday',text:name});
    // Use a leap-year reference so February 29 is always available.
    const start=new Date(2000,month-1,1).getDay();
    const count=new Date(2000,month,0).getDate();
    for(let i=0;i<start;i++)grid.createDiv({cls:'doc-empty'});
    for(let d=1;d<=count;d++){
      const md=`${pad(month)}-${pad(d)}`,n=all.get(md)?.length??0;
      const btn=grid.createEl('button',{cls:'doc-date'});btn.type='button';
      btn.createSpan({text:String(d)});
      if(n){btn.addClass('doc-has-entry');btn.createSpan({cls:'doc-dot'});}
      btn.setAttribute('aria-label',`${md}, ${n} ${n===1?'entry':'entries'} across all years`);
      btn.addEventListener('click',()=>{this.aggregateMonth=month;this.aggregateDay=d;this.level='all-years-day';this.render();});
    }
  }
  private drawMonth(parent:HTMLElement,year:number,month:number,all:Map<string,TFile[]>,compact:boolean){
    const grid=parent.createDiv({cls:`doc-days ${compact?'doc-compact':''}`});
    for(const name of ['S','M','T','W','T','F','S'])grid.createDiv({cls:'doc-weekday',text:name});
    const start=new Date(year,month-1,1).getDay();
    const count=new Date(year,month,0).getDate();
    for(let i=0;i<start;i++)grid.createDiv({cls:'doc-empty'});
    const today=new Date();
    for(let d=1;d<=count;d++){
      const key=dateKey(year,month,d),n=all.get(key)?.length??0;
      const btn=grid.createEl('button',{cls:'doc-date'});btn.type='button';
      btn.createSpan({text:String(d)});
      if(n){btn.addClass('doc-has-entry');btn.createSpan({cls:'doc-dot',text:compact?'':String(n)});}
      if(today.getFullYear()===year&&today.getMonth()+1===month&&today.getDate()===d)btn.addClass('doc-today');
      btn.setAttribute('aria-label',`${key}, ${n} ${n===1?'entry':'entries'}`);
      btn.addEventListener('click',()=>{this.year=year;this.month=month;this.day=d;this.level='day';this.render();});
    }
    if(!compact){const actions=parent.createDiv({cls:'doc-month-actions'});this.button(actions,'+ New entry today',()=>this.plugin.createEntry(new Date()));}
  }
  private drawDay(parent:HTMLElement,all:Map<string,TFile[]>){
    const key=dateKey(this.year,this.month,this.day);
    const files=all.get(key)??[];
    const actions=parent.createDiv({cls:'doc-day-actions'});
    this.button(actions,'+ New entry',()=>this.plugin.createEntry(new Date(this.year,this.month-1,this.day)),'mod-cta');
    parent.createEl('p',{cls:'doc-count',text:`${files.length} ${files.length===1?'entry':'entries'}`});
    if(!files.length){parent.createEl('p',{cls:'doc-empty-message',text:'No entries for this date yet.'});return;}
    const list=parent.createDiv({cls:'doc-entry-list'});
    for(const file of files){
      const item=list.createEl('button',{cls:'doc-entry'});
      const stamp=NAME_PATTERN.exec(file.name)?.[4]??'';
      item.createSpan({cls:'doc-entry-time',text:`${stamp.slice(0,2)}:${stamp.slice(2,4)}:${stamp.slice(4,6)||'00'}`});
      item.createSpan({cls:'doc-entry-name',text:file.basename});
      item.addEventListener('click',()=>void this.app.workspace.getLeaf('tab').openFile(file));
    }
  }
  private shift(amount:number){
    if(this.level==='year')this.year+=amount;
    else if(this.level==='month'){const d=new Date(this.year,this.month-1+amount,1);this.year=d.getFullYear();this.month=d.getMonth()+1;}
    else {const d=new Date(this.year,this.month-1,this.day+amount);this.year=d.getFullYear();this.month=d.getMonth()+1;this.day=d.getDate();}
    this.render();
  }
}

export default class DayOneCalendar extends Plugin {
  settings:Settings=DEFAULTS;
  async onload(){
    this.settings=Object.assign({},DEFAULTS,await this.loadData());
    this.registerView(VIEW_TYPE,leaf=>new CalendarView(leaf,this));
    this.addRibbonIcon('calendar-days','Open Day One Calendar',()=>void this.activate());
    this.addCommand({id:'open-calendar',name:'Open Day One Calendar',callback:()=>void this.activate()});
    this.addSettingTab(new CalendarSettings(this.app,this));
    for(const name of ['create','delete','rename','modify'] as const){
      this.registerEvent(this.app.vault.on(name,()=>this.app.workspace.getLeavesOfType(VIEW_TYPE).forEach(leaf=>(leaf.view as CalendarView).refresh())));
    }
  }
  async activate(){
    let leaf=this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    if(!leaf){leaf=this.app.workspace.getLeaf('tab');await leaf.setViewState({type:VIEW_TYPE,active:true});}
    await this.app.workspace.revealLeaf(leaf);
  }
  async createEntry(selected:Date){
    const templatesFolder=this.settings.templatesFolder.trim() || ((this.app as any).internalPlugins?.plugins?.templates?.instance?.options?.folder || 'Templates');
    const prefix=templatesFolder.replace(/^\/+|\/+$/g,'').toLowerCase()+'/';
    const templates=this.app.vault.getMarkdownFiles().filter(f=>f.path.toLowerCase().startsWith(prefix)).sort((a,b)=>a.path.localeCompare(b.path));
    const choices=templates.map(f=>({label:f.path.slice(prefix.length).replace(/\.md$/i,''),path:f.path}));
    const chosen=await new Promise<string|null|undefined>(resolve=>{
      const modal=new TemplateChoiceModal(this.app,choices,resolve);
      modal.open();
    });
    if(chosen===undefined)return;
    await this.createEntryWithTemplate(selected,chosen);
  }
  async createEntryWithTemplate(selected:Date,chosenTemplate:string|null){
    try{
      const now=new Date();
      const folder=await this.ensureFolder(normalizePath(`${this.settings.rootFolder}/${selected.getFullYear()}/${MONTH_FOLDER_NAMES[selected.getMonth()]}`));
      const date=dateKey(selected.getFullYear(),selected.getMonth()+1,selected.getDate());
      const stamp=`${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      let path=normalizePath(`${folder}/${date} ${stamp}.md`);
      // Preserve timestamp format; if an entry already exists in the same second, ask user to retry.
      if(this.app.vault.getAbstractFileByPath(path)){new Notice('An entry already exists for this timestamp. Please try again in a second.');return;}
      let content='';
      if(chosenTemplate){
        const template=this.app.vault.getAbstractFileByPath(normalizePath(chosenTemplate));
        if(!(template instanceof TFile)){new Notice('Template not found. Check the plugin settings.');return;}
        const raw=await this.app.vault.read(template);
        const templateSettings=(this.app as any).internalPlugins?.plugins?.templates?.instance?.options;
        const dateFormat=templateSettings?.dateFormat || this.settings.dateFormat;
        const timeFormat=templateSettings?.timeFormat || this.settings.timeFormat;
        // Built-in Templates tokens; other plugin-specific expressions are intentionally not evaluated.
        content=raw.replace(/{{\s*(date(?::([^}]+))?|time(?::([^}]+))?|title)\s*}}/gi,(_full,token,dateFmt,timeFmt)=>{
          if(token.toLowerCase()==='title')return `${date} ${stamp}`;
          if(token.toLowerCase().startsWith('date'))return moment(selected).format(dateFmt||dateFormat);
          return moment(now).format(timeFmt||timeFormat);
        });
      }
      const file=await this.app.vault.create(path,content);
      await this.app.workspace.getLeaf('tab').openFile(file);
      new Notice('Journal entry created');
    }catch(error){console.error('Day One Calendar: could not create entry',error);new Notice(`Could not create journal entry: ${error instanceof Error ? error.message : String(error)}`, 10000);}
  }
  private async ensureFolder(path:string):Promise<string>{
    const parts=normalizePath(path).split('/');
    let built='';
    for(const part of parts){
      const requested=built?`${built}/${part}`:part;
      const found=this.app.vault.getAllLoadedFiles().find(f=>f.path.toLowerCase()===requested.toLowerCase());
      if(found){
        if(!(found instanceof TFolder))throw new Error(`${found.path} is not a folder`);
        built=found.path;
        continue;
      }
      // Use the vault adapter when creating folders: its completion reflects the
      // underlying mobile filesystem even if the vault index is still catching up.
      if(!(await this.app.vault.adapter.exists(requested))){
        await this.app.vault.adapter.mkdir(requested);
      }
      built=requested;
    }
    return built;
  }
}
class TemplateChoiceModal extends Modal {
  private selected=false;
  constructor(app:App,private choices:{label:string;path:string}[],private finish:(path:string|null|undefined)=>void){super(app);}
  onOpen(){
    this.titleEl.setText('Choose a template');
    const list=this.contentEl.createDiv({cls:'doc-template-choices'});
    const search=this.contentEl.createEl('input',{type:'search',placeholder:'Filter templates…',cls:'doc-template-search'});
    this.contentEl.insertBefore(search,list);
    const render=()=>{
      list.empty();
      const add=(label:string,path:string|null)=>{
        const button=list.createEl('button',{text:label,cls:'doc-template-choice'});
        button.addEventListener('click',()=>{this.selected=true;this.close();this.finish(path);});
      };
      if(!search.value.trim())add('Blank entry (no template)',null);
      const matches=this.choices.filter(c=>c.label.toLowerCase().includes(search.value.trim().toLowerCase()));
      for(const choice of matches)add(choice.label,choice.path);
      if(!matches.length)list.createEl('p',{text:'No matching templates. Check the Templates folder in plugin settings.'});
    };
    search.addEventListener('input',render);render();
  }
  onClose(){this.contentEl.empty();if(!this.selected)this.finish(undefined);}
}
class CalendarSettings extends PluginSettingTab{
  plugin:DayOneCalendar;
  constructor(app:App,plugin:DayOneCalendar){super(app,plugin);this.plugin=plugin;}
  display(){const el=this.containerEl;el.empty();el.createEl('h2',{text:'Day One Calendar'});
    new Setting(el).setName('Journal root folder').setDesc('Existing journal folder, relative to vault root.').addText(t=>t.setPlaceholder('Day-One').setValue(this.plugin.settings.rootFolder).onChange(async v=>{this.plugin.settings.rootFolder=v.trim()||'Day-One';await this.plugin.saveData(this.plugin.settings);this.app.workspace.getLeavesOfType(VIEW_TYPE).forEach(leaf=>(leaf.view as CalendarView).refresh());}));
    new Setting(el).setName('Templates folder').setDesc('Folder containing your built-in Obsidian templates. Leave blank to use the Templates core plugin folder (or Templates).').addText(t=>t.setPlaceholder('Templates').setValue(this.plugin.settings.templatesFolder).onChange(async v=>{this.plugin.settings.templatesFolder=v.trim();await this.plugin.saveData(this.plugin.settings);}));
    new Setting(el).setName('Default date format').setDesc('Used when no custom format is specified in the template.').addText(t=>t.setValue(this.plugin.settings.dateFormat).onChange(async v=>{this.plugin.settings.dateFormat=v;await this.plugin.saveData(this.plugin.settings);}));
    new Setting(el).setName('Default time format').setDesc('Used when no custom format is specified in the template.').addText(t=>t.setValue(this.plugin.settings.timeFormat).onChange(async v=>{this.plugin.settings.timeFormat=v;await this.plugin.saveData(this.plugin.settings);}));
  }
}
