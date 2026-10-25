/* SPDX-License-Identifier: GPL-2.0-or-later
 * One match per WebAssembly instance, retaining native pMARS globals.
 */
#include "global.h"
#include "sim.h"
#include "webapi.h"
#include <emscripten.h>
#include <string.h>
#include <assert.h>

#define API EMSCRIPTEN_KEEPALIVE
extern void init(void);
extern void pspace_init(void);
extern char *cellview(mem_struct *, char *, int);
unsigned int web_events[WEB_CAPACITY][4];
int web_count, web_phase, web_budget, web_visual;
unsigned int web_executed;
static double deadline;
static int configured, started, loaded[MAXWARRIOR], cdb_running;
static char inspection[128];
static int completed, web_wins[MAXWARRIOR], web_ties[MAXWARRIOR], web_losses[MAXWARRIOR];
#define TRACE_CAPACITY 512
typedef struct { int owner, address; char text[96]; } web_trace_entry;
static web_trace_entry trace_entries[TRACE_CAPACITY];
static int trace_enabled, trace_count, current_cycle;
static int cdb_events_enabled, cdb_event;
API void web_set_cdb_events(int enabled) { cdb_events_enabled = !!enabled; }
API int web_cdb_event(void) { return cdb_event; }
static int debug_enabled, debug_hit, debug_skip_owner = -1, debug_skip_address;
API void web_set_debug(int enabled) { debug_enabled = !!enabled; if (!enabled) debug_skip_owner = -1; }
API int web_debug_hit(void) { return debug_hit; }
API int web_debug_copy(void) { return copyDebugInfo; }
API void web_set_debug_copy(int enabled) { copyDebugInfo = !!enabled; }
/* Browser address breakpoints: 0 inherits source markers, 1 sets, 2 clears.
   They stay at their address across writes/rounds and reset with the instance. */
static unsigned char address_breakpoints[65536];
API int web_breakpoint(int address) {
  if (!started || address < 0 || address >= coreSize || address >= 65536) return 0;
  return address_breakpoints[address] ? address_breakpoints[address] == 1 : !!memory[address].debuginfo;
}
void web_clear_breakpoint_override(int address) { if (address >= 0 && address < 65536) address_breakpoints[address] = 0; }
API int web_set_breakpoint(int address, int enabled) {
  if (!started || address < 0 || address >= coreSize || address >= 65536) return 2;
  address_breakpoints[address] = enabled ? 1 : 2;
  return 0;
}
static unsigned long long cycle_visits;
API int web_cycle(void) { return current_cycle; }
void web_record_instruction(int address)
{
  extern void web_cdb_executed(void);
  web_cdb_executed();
  /* A repeated warrior begins the next scheduler sweep; deaths are skipped. */
  unsigned long long bit = 1ULL << (W - warrior);
  if (!cycle_visits || (cycle_visits & bit)) {
    ++current_cycle;
    cycle_visits = 0;
  }
  cycle_visits |= bit;
  if (trace_enabled) {
    web_trace_entry *entry = &trace_entries[trace_count++];
    entry->owner = W - warrior;
    entry->address = address;
    cellview(memory + address, entry->text, 1);
  }
}
void web_round_complete(void)
{
  int i;
  ++completed;
  for (i = 0; i < warriors; ++i) {
    if (!warrior[i].tasks) ++web_losses[i];
    else if (warriorsLeft == 1) ++web_wins[i];
    else ++web_ties[i];
  }
}
API void web_set_trace(int enabled) { trace_enabled = !!enabled; }
API int web_trace_ptr(void) { return (int)trace_entries; }
API int web_trace_count(void) { return trace_count; }
API int web_trace_stride(void) { return sizeof(web_trace_entry); }
API int web_completed(void) { return completed; }
API int web_outcome(int index, int outcome) {
  if (index < 0 || index >= warriors || outcome < 0 || outcome >= warriors) return 0;
  return warrior[index].score[outcome];
}

void web_event(int kind, int address, int owner, int value)
{
  if (kind == WEB_RESET) { current_cycle = 0; cycle_visits = 0; }
  if (cdb_events_enabled && (kind == WEB_DEATH || kind == WEB_ROUND)) cdb_event = kind;
  if (!web_visual) return;
  /* advance reserves 64 slots before executing an instruction; initial
     load is limited to MAXWARRIOR 100-instruction warriors. Never drop events. */
  assert(web_count < WEB_CAPACITY);
  web_events[web_count][0] = kind;
  web_events[web_count][1] = address;
  web_events[web_count][2] = owner;
  web_events[web_count++][3] = value;
}

int web_should_yield(void)
{
  if (cdb_event) return 1;
  if ((trace_enabled && trace_count >= TRACE_CAPACITY) || web_budget <= 0 || web_count > WEB_CAPACITY - 64) return 1;
  if ((web_executed & 63) == 0 && emscripten_get_now() >= deadline) return 1;
  if (debug_enabled && web_breakpoint(*W->taskHead)) {
    int owner = W - warrior, address = *W->taskHead;
    if (debug_skip_owner != owner || debug_skip_address != address) {
      debug_skip_owner = owner; debug_skip_address = address;
      debug_hit = owner + 1;
      return 1;
    }
  }
  debug_skip_owner = -1;
  --web_budget;
  ++web_executed;
  return 0;
}

API int web_configure(const char *options, int visual, int num)
{
  char paths[MAXWARRIOR][32], *args[128], *part, *storage;
  int i, argc = 1, result;
  if (configured || num < 1 || num > MAXWARRIOR || strlen(options) > 4096) return 2;
  configured = 1;
  web_visual = !!visual;
  args[0] = "pmars";
  /* Retain option strings for SWITCH_F / SWITCH_eq for the instance lifetime. */
  storage = strdup(options);
  if (!storage) return MEMERR;
  part = strtok(storage, "\n");
  while (part && argc < 90) {
    args[argc++] = part;
    part = strtok(NULL, "\n");
  }
  if (part) return 2;
  for (i = 0; i < num; ++i) {
    snprintf(paths[i], sizeof(paths[i]), "/warrior-%d.red", i);
    args[argc++] = paths[i];
  }
  result = parse_param(argc, args);
  if (result) return result;
  init();
  return 0;
}
API int web_round_limit(void) { return rounds; }
API void web_print_results(void)
{
  int i, j;
  extern void results(FILE *);
  if (SWITCH_k) {
    set_reg('W', warriors);
    if (warriors == 2)
      printf("%d %d\n%d %d\n", warrior[0].score[0], warrior[0].score[1],
             warrior[1].score[0], warrior[1].score[1]);
    else for (i = 0; i < warriors; ++i) {
      printf("%d ", score(i));
      for (j = 0; j < warriors; ++j) printf("%d ", warrior[i].score[j]);
      printf("%d\n", deaths(i));
    }
  } else results(stdout);
  fflush(stdout);
}

API int web_compile(int index)
{
  if (!configured || started || index < 0 || index >= warriors || loaded[index]) return 2;
  if (!assemble(warrior[index].fileName, index) && !SWITCH_b) {
    extern char *info01;
    if (!SWITCH_A) printf(info01, warrior[index].name, warrior[index].instLen, warrior[index].authorName);
    disasm(warrior[index].instBank, warrior[index].instLen, warrior[index].offset);
    if (SWITCH_A) {
      if (warrior[index].pSpaceIndex == PIN_APPEARED)
        printf("       PIN     %6ld\n", warrior[index].pSpaceIDNumber);
      printf("       END\n");
    } else printf("\n");
  }
  fflush(stdout); fflush(stderr);
  if (errorcode == 0) loaded[index] = 1;
  return errorcode;
}

/* Compiled banks transfer only between instances of this exact Wasm build.
   No raw pointers are shared between instances. */
API int web_field(int index, int field)
{
  warrior_struct *w;
  if (index < 0 || index >= warriors) return 0;
  w = warrior + index;
  switch (field) {
  case 0: return (int)w->instBank;
  case 1: return w->instLen;
  case 2: return w->offset;
  case 3: return w->pSpaceIndex;
  case 4: return w->pSpaceIDNumber;
  case 5: return sizeof(mem_struct);
  case 6: return w->tasks;
  case 7: return web_wins[index];
  case 8: return web_ties[index];
  case 9: return web_losses[index];
  case 10: return started && w->tasks ? *w->taskHead : -1;
  case 11: set_reg('W', warriors); return score(index);
  default: return 0;
  }
}
API const char *web_name(int index, int author)
{
  if (index < 0 || index >= warriors) return "";
  return author ? warrior[index].authorName : warrior[index].name;
}
API int web_import(int index, int ptr, int length, int offset, int pinState,
                   int pin, const char *name, const char *author)
{
  warrior_struct *w;
  if (!configured || started || index < 0 || index >= warriors || loaded[index] ||
      length < 1 || length > instrLim || !ptr ||
      (pinState != UNSHARED && pinState != PIN_APPEARED)) return 2;
  w = warrior + index;
  w->instBank = (mem_struct *)ptr; w->instLen = length; w->offset = offset;
  w->pSpaceIndex = pinState; w->pSpaceIDNumber = pin;
  w->name = strdup(name); w->authorName = strdup(author);
  if (!w->name || !w->authorName) return MEMERR;
  loaded[index] = 1;
  return 0;
}
API int web_start(void)
{
  int i;
  if (started || !configured) return 2;
  for (i = 0; i < warriors; ++i) if (!loaded[i]) return 2;
  started = 1;
  pspace_init();
  simulator1(); /* loads first round and returns without executing */
  return 0;
}
API int web_advance(int instructions, double milliseconds)
{
  if (cdb_running || !started || instructions < 1 || instructions > 100000 ||
      !(milliseconds > 0 && milliseconds <= 8)) return -1;
  web_count = 0;
  debug_hit = 0;
  cdb_event = 0;
  trace_count = 0;
  web_executed = 0;
  web_budget = instructions;
  deadline = emscripten_get_now() + milliseconds;
  if (web_phase != 3) simulator1();
  return web_phase == 3;
}
API int web_event_ptr(void) { return (int)web_events; }
API int web_event_count(void) { return web_count; }
API int web_steps(void) { return web_executed; }
API int web_round(void) { return round_num; }
API const char *web_inspect(int address)
{
  if (!started || address < 0 || address >= coreSize) return "";
  return cellview(memory + address, inspection, 1);
}

/* cdb expects the current task to have been popped, whereas browser slices
   stop before popping it. Adapt that boundary, including execute/PC changes. */
API int web_cdb(void) {
  int result, popped;
  static int macros_loaded;
  extern void load_macros(char *);
  if (!started) return 4;
  if (!macros_loaded) { char a[] = "/pmars.mac", b[] = "/mw.mac"; load_macros(a); load_macros(b); macros_loaded = 1; }
  popped = W->tasks > 0;
  if (popped) { progCnt = *W->taskHead++; if (W->taskHead == endQueue) W->taskHead = taskQueue; }
  cdb_running = 1;
  result = cdb("");
  cdb_running = 0;
  if (popped) { if (W->taskHead == taskQueue) W->taskHead = endQueue; *--W->taskHead = progCnt; }
  return result;
}
