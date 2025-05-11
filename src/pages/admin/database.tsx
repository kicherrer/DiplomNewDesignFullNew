import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '@/components/Admin/AdminLayout';
import styled from 'styled-components';
import { useAuth } from '@/hooks/useAuth';

const DatabaseContainer = styled.div`
  padding: 20px;
`;

const TableList = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 20px;
  margin-top: 20px;
`;

const TableCard = styled.div`
  background: ${({ theme }) => theme.colors.card};
  border-radius: 8px;
  padding: 15px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: transform 0.2s ease-in-out;

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  }
`;

const TableName = styled.h3`
  margin: 0 0 10px 0;
  color: ${({ theme }) => theme.colors.text};
`;

const TableInfo = styled.p`
  margin: 5px 0;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: 0.9em;
`;

const DataTable = styled.div`
  margin-top: 20px;
  overflow-x: auto;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  background: ${({ theme }) => theme.colors.card};
  border-radius: 8px;
  overflow: hidden;
`;

const Th = styled.th`
  padding: 12px;
  text-align: left;
  background: ${({ theme }) => theme.colors.primary};
  color: white;
`;

const Td = styled.td`
  padding: 12px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const BackButton = styled.button`
  padding: 8px 15px;
  border: none;
  border-radius: 4px;
  background-color: ${({ theme }) => theme.colors.primary};
  color: white;
  cursor: pointer;
  margin-bottom: 20px;

  &:hover {
    opacity: 0.9;
  }
`;

interface TableInfo {
  name: string;
  rowCount: number;
}

const DatabaseViewer = () => {
  const router = useRouter();
  const { user } = useAuth();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== 'ADMIN') {
      router.push('/auth/login');
      return;
    }
    setIsAuthorized(true);
    loadTables();
  }, [user, router]);

  const loadTables = async () => {
    try {
      const response = await fetch('/api/admin/database/tables', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (!response.ok) throw new Error('Ошибка при загрузке таблиц');
      
      const data = await response.json();
      setTables(data);
    } catch (error) {
      console.error('Error loading tables:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTableData = async (tableName: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/admin/database/tables/${tableName}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (!response.ok) throw new Error('Ошибка при загрузке данных таблицы');
      
      const data = await response.json();
      setTableData(data);
      setSelectedTable(tableName);
    } catch (error) {
      console.error('Error loading table data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthorized || isLoading) {
    return <div>Загрузка...</div>;
  }

  return (
    <AdminLayout>
      <DatabaseContainer>
        <h1>Просмотр базы данных</h1>
        
        {selectedTable ? (
          <>
            <BackButton onClick={() => setSelectedTable(null)}>
              Назад к списку таблиц
            </BackButton>
            <h2>Таблица: {selectedTable}</h2>
            <DataTable>
              {tableData.length > 0 && (
                <Table>
                  <thead>
                    <tr>
                      {Object.keys(tableData[0]).map((column) => (
                        <Th key={column}>{column}</Th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.map((row, index) => (
                      <tr key={index}>
                        {Object.values(row).map((value: any, i) => (
                          <Td key={i}>
                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                          </Td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </DataTable>
          </>
        ) : (
          <TableList>
            {tables.map((table) => (
              <TableCard key={table.name} onClick={() => loadTableData(table.name)}>
                <TableName>{table.name}</TableName>
                <TableInfo>Количество записей: {table.rowCount}</TableInfo>
              </TableCard>
            ))}
          </TableList>
        )}
      </DatabaseContainer>
    </AdminLayout>
  );
};

export default DatabaseViewer;