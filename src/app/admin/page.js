"use client"

import { useState, useEffect } from 'react';
import axios from 'axios';
import Header from '@/components/header';
import Footer from '@/components/footer';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Slab } from 'react-loading-indicators';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const BASE_URL = "https://mucollegdb.pockethost.io";
const ENDPOINT_GET_DISPATCH = "/api/collections/dispatch/records";
const ENDPOINT_GET_COLLEGES = "/api/collections/colleges/records";
const HEADERS = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_ACCESS_TOKEN', // Ensure you replace this with your actual API token
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const formatDateForAPI = (date) => {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0));
  return utcDate.toISOString();
};

const formatDateForDisplay = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB');
};

const generateRandomColor = () => {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
};

export default function DispatchViewer() {
  const [dispatchData, setDispatchData] = useState([]);
  const [collegeData, setCollegeData] = useState([]);
  const [collegeCache, setCollegeCache] = useState({});
  const [filteredData, setFilteredData] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [routeCodeFilter, setRouteCodeFilter] = useState('All');
  const [collegeCodeFilter, setCollegeCodeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    if (selectedDate) {
      fetchDispatchData();
    }
  }, [selectedDate]);

  useEffect(() => {
    applyFilters();
  }, [routeCodeFilter, collegeCodeFilter, statusFilter, dispatchData, collegeData, currentPage]);

  const fetchDispatchData = async () => {
    setLoading(true);
    setLoadingStatus('Fetching dispatch data...');
    try {
      let page = 1;
      let morePages = true;
      let allDispatchData = [];

      const formattedDate = formatDateForAPI(selectedDate);

      while (morePages) {
        const response = await axios.get(`${BASE_URL}${ENDPOINT_GET_DISPATCH}?filter=exam_date=%${formattedDate}%&page=${page}&perPage=30`, { headers: HEADERS });
        if (response.status === 200) {
          allDispatchData = [...allDispatchData, ...response.data.items];
          morePages = response.data.totalPages > page;
          page++;
          setLoadingStatus(`Fetched ${allDispatchData.length} dispatch records...`);

          if (page % 10 === 0) {
            await delay(4000); // Add a delay of 4 seconds after every batch of 30 records
          }
        } else {
          morePages = false;
        }
      }
      setDispatchData(allDispatchData);
      localStorage.setItem(`dispatchData-${formattedDate}`, JSON.stringify(allDispatchData));
      setLoadingStatus('Dispatch data fetching complete.');
      fetchCollegeData(allDispatchData);
    } catch (error) {
      console.error('Error fetching dispatch data', error);
      toast.error('Error fetching dispatch data');
      setLoadingStatus('Error fetching dispatch data.');
    }
  };

  const fetchCollegeData = async (dispatchData) => {
    setLoading(true);
    setLoadingStatus('Fetching related college data...');
    try {
      const collegeIds = [...new Set(dispatchData.map(item => item.college))];
      let allColleges = [];

      for (let i = 0; i < collegeIds.length; i += 5) {  // Fetch 5 colleges in parallel
        const batchIds = collegeIds.slice(i, i + 5);
        const promises = batchIds.map(id => {
          if (collegeCache[id]) {
            return Promise.resolve({ data: collegeCache[id] });
          } else {
            return axios.get(`${BASE_URL}${ENDPOINT_GET_COLLEGES}/${id}`, { headers: HEADERS });
          }
        });

        const responses = await Promise.all(promises);
        for (const response of responses) {
          if (response.status === 200) {
            allColleges.push(response.data);
            setCollegeCache(prevCache => ({ ...prevCache, [response.data.id]: response.data }));
          }
        }

        if (i + 5 < collegeIds.length) {
          await delay(2000); // Add a delay of 2 seconds after every batch of requests
        }
      }
      setCollegeData(allColleges);
      setLoadingStatus('College data fetching complete.');
    } catch (error) {
      console.error('Error fetching college data', error);
      toast.error('Error fetching college data');
      setLoadingStatus('Error fetching college data.');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    console.log('Applying filters with the following settings:', {
      routeCodeFilter,
      collegeCodeFilter,
      statusFilter,
      dispatchData,
      collegeData,
    });

    let filtered = [...dispatchData];

    if (routeCodeFilter !== 'All') {
      filtered = filtered.filter(item => {
        const college = collegeData.find(c => c.id === item.college);
        const collegeRouteCode = college ? Number(college.route_code) : null;
        const routeCodeFilterNumber = Number(routeCodeFilter);
        console.log('Filtering by route code:', routeCodeFilterNumber, 'College route code:', collegeRouteCode);
        return college && collegeRouteCode === routeCodeFilterNumber;
      });
    }
    if (collegeCodeFilter !== 'All') {
      filtered = filtered.filter(item => {
        const college = collegeData.find(c => c.id === item.college);
        console.log('Filtering by college code:', collegeCodeFilter, 'College code:', college?.college_id);
        return college && college.college_id === collegeCodeFilter;
      });
    }
    if (statusFilter !== 'All') {
      filtered = filtered.filter(item => {
        console.log('Filtering by status:', statusFilter, 'Dispatch status:', item.status);
        return item.status === statusFilter;
      });
    }

    console.log('Filtered data:', filtered);

    // Group by college and count exams
    const groupedData = filtered.reduce((acc, record) => {
      const college = collegeData.find(c => c.id === record.college);
      if (college) {
        if (!acc[college.id]) {
          acc[college.id] = {
            ...college,
            exams: [],
          };
        }
        acc[college.id].exams.push(record);
      }
      return acc;
    }, {});

    const uniqueDataWithCounts = Object.values(groupedData);

    setFilteredData(uniqueDataWithCounts);
  };

  const getRouteCodes = () => {
    const routeCodes = dispatchData.map(item => {
      const college = collegeData.find(c => c.id === item.college);
      return college ? college.route_code : null;
    }).filter(routeCode => routeCode !== null);
    return ['All', ...new Set(routeCodes)];
  };

  const getCollegeCodes = () => {
    const collegeCodes = dispatchData.map(item => {
      const college = collegeData.find(c => c.id === item.college);
      return college ? college.college_id : null;
    }).filter(collegeCode => collegeCode !== null);
    return ['All', ...new Set(collegeCodes)];
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const handleDateChange = (date) => {
    setSelectedDate(date);
    setDispatchData([]);
    setCollegeData([]);
    setFilteredData([]);
    localStorage.removeItem(`dispatchData-${formatDateForAPI(date)}`);
  };

  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Generate unique background colors for each date
  const dateColors = {};
  filteredData.forEach(college => {
    college.exams.forEach(exam => {
      const examDate = exam.exam_date;
      if (!dateColors[examDate]) {
        dateColors[examDate] = generateRandomColor();
      }
    });
  });

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow container mx-auto p-4">
        <ToastContainer />
        <h1 className="text-2xl font-bold mb-4">College Dispatch Data Viewer</h1>
        <div className="flex flex-wrap mb-4 space-x-4 items-center">
          <div className="flex flex-col">
            <label className="mb-2">Select a Date</label>
            <DatePicker
              selected={selectedDate}
              onChange={handleDateChange}
              placeholderText="Select a Date"
              className="border p-2 rounded"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-2">Select Route Code</label>
            <select
              value={routeCodeFilter}
              onChange={(e) => setRouteCodeFilter(e.target.value)}
              className="border p-2 rounded"
              disabled={!selectedDate}
            >
              {getRouteCodes().map(routeCode => (
                <option key={routeCode} value={routeCode}>{routeCode}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="mb-2">Select College Code</label>
            <select
              value={collegeCodeFilter}
              onChange={(e) => setCollegeCodeFilter(e.target.value)}
              className="border p-2 rounded"
              disabled={!selectedDate}
            >
              {getCollegeCodes().map(collegeCode => (
                <option key={collegeCode} value={collegeCode}>{collegeCode}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="mb-2">Select Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border p-2 rounded"
              disabled={!selectedDate}
            >
              <option value="All">All</option>
              <option value="Pending">Pending</option>
              <option value="complete">Complete</option>
            </select>
          </div>
        </div>
        {loading ? (
          <div className="flex flex-col items-center">
            <Slab color="#32cd32" size="medium" text="" textColor="" />
            <p className="mt-2">{loadingStatus}</p>
          </div>
        ) : (
          <>
            <table className="min-w-full bg-white">
              <thead>
                <tr>
                  <th className="py-2 px-4 border">College Code</th>
                  <th className="py-2 px-4 border">College Name</th>
                  <th className="py-2 px-4 border">Route Code</th>
                  <th className="py-2 px-4 border">Route Name</th>
                  <th className="py-2 px-4 border">Exam Date</th>
                  <th className="py-2 px-4 border">Status</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.map(college => (
                  college.exams.map((exam, index) => (
                    <tr key={`${college.id}-${exam.exam_date}-${index}`}>
                      {index === 0 && (
                        <>
                          <td className="py-2 px-4 border" rowSpan={college.exams.length}>{college.college_id}</td>
                          <td className="py-2 px-4 border" rowSpan={college.exams.length}>
                            {college.college_name}
                            <span className="text-sm text-blue-600"> ({college.exams.length} exams)</span>
                          </td>
                          <td className="py-2 px-4 border" rowSpan={college.exams.length}>{college.route_code}</td>
                          <td className="py-2 px-4 border" rowSpan={college.exams.length}>{college.route_name}</td>
                        </>
                      )}
                      <td className="py-2 px-4 border" style={{ backgroundColor: dateColors[exam.exam_date] }}>{formatDateForDisplay(exam.exam_date)}</td>
                      {exam.status=="Pending" ?
                      <td className="py-2 px-4 border text-red-600" >{exam.status}</td>:
                      <td className="py-2 px-4 border text-green-400" >{exam.status}</td>
}
                    </tr>
                  ))
                ))}
              </tbody>
            </table>
            <div className="flex justify-between items-center mt-4">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="bg-blue-500 text-white py-2 px-4 rounded disabled:opacity-50"
              >
                Previous
              </button>
              <span>Page {currentPage} of {Math.ceil(filteredData.length / itemsPerPage)}</span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === Math.ceil(filteredData.length / itemsPerPage)}
                className="bg-blue-500 text-white py-2 px-4 rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
