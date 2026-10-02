import { describe, expect, it } from 'vitest';
import type { Chat } from '@/entities/chat';
import { filterChats } from './filterChats';

function chat(id: string, title: string, phone: string | null): Chat {
  return { id, title, phone, chatType: 'user', unreadCount: 0, lastActivity: 0, lastPreview: '' };
}

const chats = [
  chat('1', 'Иван Петров', '79991234567'),
  chat('2', 'Семён', '79990000001'),
  chat('3', '+375291234567', '375291234567'),
  chat('4', 'Поддержка', null),
];

const found = (query: string) => filterChats(chats, query).map(({ id }) => id);

describe('filterChats', () => {
  it('возвращает исходный список для пустого запроса', () => {
    expect(filterChats(chats, '')).toBe(chats);
    expect(filterChats(chats, '   ')).toBe(chats);
  });

  it('ищет по части имени без учёта регистра', () => {
    expect(found('иван')).toEqual(['1']);
    expect(found('ПЕТР')).toEqual(['1']);
    expect(found('  поддерж ')).toEqual(['4']);
  });

  it('не различает «е» и «ё»', () => {
    expect(found('семен')).toEqual(['2']);
    expect(found('Семён')).toEqual(['2']);
  });

  it('ищет по номеру в любом формате ввода', () => {
    expect(found('+7 999 123')).toEqual(['1']);
    expect(found('8 (999) 123-45-67')).toEqual(['1']);
    expect(found('1234567')).toEqual(['1', '3']);
    expect(found('375 29')).toEqual(['3']);
  });

  it('сохраняет порядок чатов', () => {
    expect(found('7999')).toEqual(['1', '2']);
  });

  it('не принимает цифры в текстовом запросе за номер', () => {
    expect(found('Иван 2')).toEqual([]);
  });

  it('возвращает пустой список, если ничего не подошло', () => {
    expect(found('мария')).toEqual([]);
    expect(found('000 555')).toEqual([]);
  });
});
