import { useState } from 'react';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

const TestConnection = () => {
  const { getSheets, getData, isLoading, error } = useGoogleSheets();
  const [sheets, setSheets] = useState<string[]>([]);
  const [bdadosData, setBdadosData] = useState<string[][]>([]);
  const [fabricantesData, setFabricantesData] = useState<string[][]>([]);
  const [usuariosData, setUsuariosData] = useState<string[][]>([]);
  const [tested, setTested] = useState(false);

  const testConnection = async () => {
    setTested(true);
    
    // Test 1: Get all sheets
    const sheetsList = await getSheets();
    setSheets(sheetsList);
    
    // Test 2: Get Bdados data
    const bdados = await getData('Bdados');
    setBdadosData(bdados);
    
    // Test 3: Get FABRICANTES data
    const fabricantes = await getData('FABRICANTES');
    setFabricantesData(fabricantes);
    
    // Test 4: Get usuários data
    const usuarios = await getData('usuários');
    setUsuariosData(usuarios);
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Teste de Conexão - Google Sheets</h1>
        
        <Button onClick={testConnection} disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Testando...
            </>
          ) : (
            'Testar Conexão'
          )}
        </Button>

        {error && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <XCircle className="h-5 w-5" />
                Erro na Conexão
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {tested && !error && sheets.length > 0 && (
          <>
            <Card className="border-green-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  Conexão Bem Sucedida!
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-2">Abas encontradas na planilha:</p>
                <ul className="list-disc pl-5 space-y-1">
                  {sheets.map((sheet, i) => (
                    <li key={i} className="text-sm">{sheet}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Dados da aba "Bdados"</CardTitle>
              </CardHeader>
              <CardContent>
                {bdadosData.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aba vazia ou não encontrada</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          {bdadosData[0]?.map((header, i) => (
                            <th key={i} className="p-2 text-left font-medium">{header || `Coluna ${i + 1}`}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {bdadosData.slice(1, 6).map((row, i) => (
                          <tr key={i} className="border-b">
                            {row.map((cell, j) => (
                              <td key={j} className="p-2">{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {bdadosData.length > 6 && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Mostrando 5 de {bdadosData.length - 1} registros
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Fabricantes (Coluna D da aba "FABRICANTES")</CardTitle>
              </CardHeader>
              <CardContent>
                {fabricantesData.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aba vazia ou não encontrada</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {fabricantesData.slice(1).map((row, i) => (
                      row[3] && (
                        <span key={i} className="rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">
                          {row[3]}
                        </span>
                      )
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Usuários (aba "usuários")</CardTitle>
              </CardHeader>
              <CardContent>
                {usuariosData.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aba vazia ou não encontrada</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="p-2 text-left font-medium">Nome</th>
                          <th className="p-2 text-left font-medium">Email</th>
                          <th className="p-2 text-left font-medium">Senha (mascarada)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usuariosData.slice(1, 6).map((row, i) => (
                          <tr key={i} className="border-b">
                            <td className="p-2">{row[0] || '-'}</td>
                            <td className="p-2">{row[1] || '-'}</td>
                            <td className="p-2">{row[2] ? '******' : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default TestConnection;
