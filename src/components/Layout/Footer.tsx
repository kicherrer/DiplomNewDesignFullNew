import React from 'react';
import styled from 'styled-components';
import Link from 'next/link';

const FooterContainer = styled.footer`
  background-color: ${({ theme }) => theme.colors.gray[800]};
  color: ${({ theme }) => theme.colors.gray[100]};
  padding: ${({ theme }) => theme.spacing.xl} 0;
  margin-top: auto;
`;

const FooterContent = styled.div`
  max-width: ${({ theme }) => theme.breakpoints.desktop};
  margin: 0 auto;
  padding: 0 ${({ theme }) => theme.spacing.md};
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: ${({ theme }) => theme.spacing.xl};
`;

const FooterSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`;

const FooterTitle = styled.h3`
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;

const FooterLink = styled(Link)`
  color: ${({ theme }) => theme.colors.gray[300]};
  transition: color 0.2s;
  &:hover {
    color: ${({ theme }) => theme.colors.gray[100]};
  }
`;

const Copyright = styled.div`
  text-align: center;
  margin-top: ${({ theme }) => theme.spacing.xl};
  padding-top: ${({ theme }) => theme.spacing.md};
  border-top: 1px solid ${({ theme }) => theme.colors.gray[700]};
  color: ${({ theme }) => theme.colors.gray[400]};
`;

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <FooterContainer>
      <FooterContent>
        <FooterSection>
          <FooterTitle>О проекте</FooterTitle>
          <FooterLink href="/about">О нас</FooterLink>
          <FooterLink href="/contact">Контакты</FooterLink>
          <FooterLink href="/terms">Условия использования</FooterLink>
          <FooterLink href="/privacy">Политика конфиденциальности</FooterLink>
        </FooterSection>

        <FooterSection>
          <FooterTitle>Категории</FooterTitle>
          <FooterLink href="/catalog/movies">Фильмы</FooterLink>
          <FooterLink href="/catalog/series">Сериалы</FooterLink>
          <FooterLink href="/catalog/animation">Анимация</FooterLink>
          <FooterLink href="/catalog/documentary">Документальные</FooterLink>
        </FooterSection>

        <FooterSection>
          <FooterTitle>Сообщество</FooterTitle>
          <FooterLink href="/blog">Блог</FooterLink>
          <FooterLink href="/forum">Форум</FooterLink>
          <FooterLink href="/help">Помощь</FooterLink>
          <FooterLink href="/feedback">Обратная связь</FooterLink>
        </FooterSection>
      </FooterContent>

      <Copyright>
        © {currentYear} MediaApp. Все права защищены.
      </Copyright>
    </FooterContainer>
  );
};

export default Footer;