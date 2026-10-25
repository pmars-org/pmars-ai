/* SPDX-License-Identifier: GPL-2.0-or-later */
#ifndef PMARS_WEBAPI_H
#define PMARS_WEBAPI_H
#define WEB_CAPACITY 65536
/* Four unsigned 32-bit words per event: kind, address, warrior, value.
   Kinds: reset, load, execute, read, write, decrement, increment,
   process count, warrior death, round end. */
enum { WEB_RESET, WEB_LOAD, WEB_EXEC, WEB_READ, WEB_WRITE, WEB_DEC,
       WEB_INC, WEB_TASKS, WEB_DEATH, WEB_ROUND };
extern unsigned int web_events[WEB_CAPACITY][4];
extern int web_count, web_phase, web_budget, web_visual;
extern unsigned int web_executed;
int web_should_yield(void);
void web_record_instruction(int address);
void web_round_complete(void);
void web_event(int kind, int address, int owner, int value);
#endif
